import { json, uid } from './_util.js';
import { buildStripeSessionParams, getMerchProduct, holdInventory, releaseHold } from './_merch.js';

export async function onRequestPost({ request, env }){
  let holdId = '';
  try{
    const stripeSecret = String(env.STRIPE_SECRET_KEY || '').trim();
    if(!stripeSecret){
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
    holdId = uid();
    const held = await holdInventory(env, { sessionId: holdId, productId, size, qty: 1 });
    if(!held.ok) return json({ ok:false, error:'sold_out' }, 409);
    const stripeBody = buildStripeSessionParams({ origin, product, size, sessionId: holdId });
    let stripeRes;
    try {
      stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeSecret}`,
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: stripeBody.toString()
      });
    } catch (fetchErr) {
      await releaseHold(env, holdId).catch(() => {});
      return json({ ok:false, error:'stripe_request_failed', detail: String(fetchErr?.message || fetchErr) }, 502);
    }
    const stripeJson = await stripeRes.json().catch(() => ({}));
    if(!stripeRes.ok || !stripeJson?.url){
      await releaseHold(env, holdId).catch(() => {});
      return json({ ok:false, error:'stripe_checkout_failed', detail: stripeJson }, 502);
    }
    return json({ ok:true, url: stripeJson.url, sessionId: stripeJson.id });
  }catch(err){
    if (holdId) {
      await releaseHold(env, holdId).catch(() => {});
    }
    return json({ ok:false, error:'server_error', detail: String(err?.message || err) }, 500);
  }
}
