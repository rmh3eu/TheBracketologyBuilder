import { json } from './_util.js';
import { ensureMerchSchema, releaseReservation } from './_merch.js';

async function hmacHex(secret, payload){
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sigBuf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

async function verifyStripeSignature(request, bodyText, secret){
  const sig = request.headers.get('stripe-signature') || '';
  if(!sig || !secret) return false;
  const parts = Object.fromEntries(sig.split(',').map(p => {
    const i = p.indexOf('=');
    return i > -1 ? [p.slice(0,i), p.slice(i+1)] : [p, ''];
  }));
  if(!parts.t || !parts.v1) return false;
  const signedPayload = `${parts.t}.${bodyText}`;
  const expected = await hmacHex(secret, signedPayload);
  return expected === parts.v1;
}

async function markPaid(env, evt){
  await ensureMerchSchema(env);
  const session = evt?.data?.object || {};
  const reservationId = String(session?.metadata?.reservation_id || session?.client_reference_id || '').trim();
  if(!reservationId) return;

  const nowIso = new Date().toISOString();
  const reservation = await env.DB.prepare(`SELECT * FROM merch_reservations WHERE id = ?`).bind(reservationId).first();
  if(!reservation) return;

  await env.DB.prepare(`UPDATE merch_reservations
    SET status = 'paid', completed_at = ?, stripe_session_id = COALESCE(stripe_session_id, ?), buyer_email = COALESCE(?, buyer_email)
    WHERE id = ?`)
    .bind(nowIso, String(session.id || ''), String(session.customer_details?.email || session.customer_email || ''), reservationId).run();

  await env.DB.prepare(`INSERT OR IGNORE INTO merch_orders (
    id, reservation_id, stripe_session_id, stripe_payment_intent, variant_id, product_id, quantity,
    amount_total, currency, buyer_email, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      crypto.randomUUID(),
      reservationId,
      String(session.id || ''),
      String(session.payment_intent || ''),
      reservation.variant_id,
      reservation.product_id,
      Number(reservation.quantity || 1),
      Number(session.amount_total || 0),
      String(session.currency || 'usd'),
      String(session.customer_details?.email || session.customer_email || ''),
      nowIso
    ).run();
}

async function markExpiredOrReleased(env, evt){
  const session = evt?.data?.object || {};
  const reservationId = String(session?.metadata?.reservation_id || session?.client_reference_id || '').trim();
  if(!reservationId) return;
  await releaseReservation(env, reservationId);
}

export async function onRequestPost({ request, env }){
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if(!secret){
    return json({ ok:false, error:'Missing STRIPE_WEBHOOK_SECRET' }, 500);
  }

  const bodyText = await request.text();
  const valid = await verifyStripeSignature(request, bodyText, secret);
  if(!valid){
    return json({ ok:false, error:'Invalid signature' }, 400);
  }

  let evt = null;
  try{ evt = JSON.parse(bodyText); }catch(_e){ return json({ ok:false, error:'Invalid payload' }, 400); }

  try{
    if(evt?.type === 'checkout.session.completed'){
      await markPaid(env, evt);
    } else if(evt?.type === 'checkout.session.expired' || evt?.type === 'checkout.session.async_payment_failed'){
      await markExpiredOrReleased(env, evt);
    }
    return json({ ok:true });
  }catch(e){
    return json({ ok:false, error: e.message || 'Webhook handling failed' }, 500);
  }
}
