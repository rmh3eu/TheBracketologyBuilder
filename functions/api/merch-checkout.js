import { json, uid } from './_util.js';
import { buildStripeSessionParams, getMerchProduct, holdInventory } from './_merch.js';

export async function onRequestPost({ request, env }){
  try{
    if(!env.STRIPE_SECRET_KEY){
      return json({ ok:false, error:'missing_stripe_secret' }, 500);
    }
    const body = await request.json().catch(() => ({}));
    const productId = String(body.productId || '').trim();
    const size = String(body.size || '').trim();
    const product = getMerchProduct(productId);
    if(!product) return json({ ok:false, error:'invalid_product' }, 400);
    if(!size || !(product.sizes || []).some(s => s.size === size)){
      return json({ ok:false, error:'invalid_size' }, 400);
    }
    const origin = new URL(request.url).origin;
    const holdId = uid();
    const held = await holdInventory(env, { sessionId: holdId, productId, size, qty: 1 });
    if(!held.ok) return json({ ok:false, error:'sold_out' }, 409);
    const stripeBody = buildStripeSessionParams({ origin, product, size, sessionId: holdId });
    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: stripeBody.toString()
    });
    const stripeJson = await stripeRes.json();
    if(!stripeRes.ok || !stripeJson?.url){
      return json({ ok:false, error:'stripe_checkout_failed', detail: stripeJson }, 502);
    }
    return json({ ok:true, url: stripeJson.url, sessionId: stripeJson.id });
  }catch(err){
    return json({ ok:false, error:'server_error', detail: String(err?.message || err) }, 500);
  }
}
