import { json, getIp, rateLimit } from './_util.js';
import { reserveMerchVariant, releaseReservation } from './_merch.js';

function formBodyFromObject(obj){
  const sp = new URLSearchParams();
  for(const [k,v] of Object.entries(obj)){
    if(v === undefined || v === null) continue;
    sp.append(k, String(v));
  }
  return sp;
}

export async function onRequestPost({ request, env }){
  try{
    const rl = await rateLimit(env, `merch:${getIp(request)}`, 12, 60);
    if(!rl.ok) return json({ ok:false, error:'Too many attempts. Please wait a minute.' }, 429, { 'retry-after': String(rl.retryAfter || 60) });

    const stripeKey = env.STRIPE_SECRET_KEY;
    if(!stripeKey) return json({ ok:false, error:'Stripe is not configured yet.' }, 500);

    const body = await request.json().catch(()=>null);
    const variantId = String(body?.variant_id || '').trim();
    if(!variantId) return json({ ok:false, error:'Please choose a shirt.' }, 400);

    const reservation = await reserveMerchVariant(env, {
      variantId,
      quantity: 1,
      requestIp: getIp(request),
      requestUa: request.headers.get('user-agent') || ''
    });

    const siteOrigin = `https://${(env.SITE_DOMAIN || 'bracketologybuilder.com').replace(/^https?:\/\//,'').replace(/\/$/,'')}`;
    const title = reservation.product.title;
    const variantLabel = reservation.variant.label || 'One size';
    const description = reservation.product.description || 'Limited merch drop';
    const amount = Number(reservation.product.price_cents || 0);

    const payload = formBodyFromObject({
      mode: 'payment',
      success_url: `${siteOrigin}/merch-success.html?session_id={CHECKOUT_SESSION_ID}&reservation_id=${encodeURIComponent(reservation.reservationId)}`,
      cancel_url: `${siteOrigin}/merch-cancel.html?reservation_id=${encodeURIComponent(reservation.reservationId)}`,
      'line_items[0][quantity]': 1,
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][unit_amount]': amount,
      'line_items[0][price_data][product_data][name]': `${title} — ${variantLabel}`,
      'line_items[0][price_data][product_data][description]': description,
      'line_items[0][price_data][product_data][images][0]': reservation.product.image ? `${siteOrigin}${reservation.product.image}` : undefined,
      client_reference_id: reservation.reservationId,
      'metadata[reservation_id]': reservation.reservationId,
      'metadata[variant_id]': reservation.variant.id,
      'metadata[product_id]': reservation.product.id,
      'metadata[variant_label]': variantLabel,
      expires_at: Math.floor(new Date(reservation.expiresAt).getTime() / 1000)
    });

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: payload.toString()
    });

    const data = await res.json().catch(()=>({}));
    if(!res.ok || !data?.url){
      await releaseReservation(env, reservation.reservationId);
      const message = data?.error?.message || 'Unable to start checkout.';
      return json({ ok:false, error: message }, 500);
    }

    if(data.id){
      await env.DB.prepare(`UPDATE merch_reservations SET stripe_session_id = ? WHERE id = ?`).bind(String(data.id), reservation.reservationId).run().catch(()=>{});
    }

    return json({ ok:true, url: data.url });
  }catch(e){
    if(e?.code === 'SOLD_OUT') return json({ ok:false, error:'Sorry, that shirt just sold out.' }, 409);
    return json({ ok:false, error: e.message || 'Unable to start checkout.' }, 500);
  }
}
