import { json } from './_util.js';
import { completeOrder, fetchStripeSession, releaseHold } from './_merch.js';

async function verifyStripeSignature(request, secret){
  const sig = request.headers.get('stripe-signature') || '';
  const body = await request.text();
  const parts = Object.fromEntries(sig.split(',').map(p => p.split('=')).filter(p => p.length === 2));
  const t = parts.t;
  const v1 = parts.v1;
  if(!t || !v1) throw new Error('Missing stripe signature parts');
  const payload = `${t}.${body}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2,'0')).join('');
  if(hex !== v1) throw new Error('Invalid stripe signature');
  return JSON.parse(body);
}

export async function onRequestPost({ request, env }){
  try{
    if(!env.STRIPE_WEBHOOK_SECRET){
      return json({ ok:false, error:'missing_webhook_secret' }, 500);
    }
    const event = await verifyStripeSignature(request, env.STRIPE_WEBHOOK_SECRET);
    if(event?.type === 'checkout.session.completed'){
      const session = event.data?.object || {};
      const holdId = String(session.client_reference_id || session.metadata?.session_id || '').trim();
      if(holdId){
        const full = await fetchStripeSession(env, session.id);
        const productId = String(full.metadata?.product_id || full.payment_intent?.metadata?.product_id || '').trim();
        const size = String(full.metadata?.size || full.payment_intent?.metadata?.size || '').trim();
        const amountCents = Number(full.amount_total || 0);
        const email = full.customer_details?.email || '';
        const shipName = full.customer_details?.name || full.shipping_details?.name || '';
        const shippingJson = JSON.stringify(full.customer_details?.address || full.shipping_details?.address || {});
        await completeOrder(env, {
          sessionId: holdId,
          productId,
          size,
          qty: 1,
          amountCents,
          currency: full.currency || 'usd',
          customerEmail: email,
          shippingName: shipName,
          shippingJson,
          paymentStatus: full.payment_status || ''
        });
      }
    } else if(event?.type === 'checkout.session.expired'){
      const session = event.data?.object || {};
      const holdId = String(session.client_reference_id || session.metadata?.session_id || '').trim();
      if(holdId) await releaseHold(env, holdId);
    }
    return new Response('ok', { status: 200 });
  }catch(err){
    return new Response(`webhook error: ${String(err?.message || err)}`, { status: 400 });
  }
}
