
import { json, requireUser, ensureUserSchema } from "./_util.js";

const DEFAULT_PRICE_ID = "price_1THVwSRLL3yuhoRUfdZCX0dz";

function getBaseUrl(request, env){
  const configured = String(env.BASE_URL || '').trim();
  if(configured) return configured.replace(/\/+$/, '');
  const u = new URL(request.url);
  return `${u.protocol}//${u.host}`;
}

export async function onRequestPost({ request, env }){
  await ensureUserSchema(env);
  const user = await requireUser({ request, env });
  if(!user) return json({ ok:false, error:'signin_required' }, 401);

  const secret = String(env.STRIPE_SECRET_KEY || '').trim();
  const priceId = String(env.STRIPE_PRICE_ID || DEFAULT_PRICE_ID).trim();
  if(!secret) return json({ ok:false, error:'missing_stripe_secret_key' }, 500);
  if(!priceId) return json({ ok:false, error:'missing_stripe_price_id' }, 500);

  const baseUrl = getBaseUrl(request, env);
  const successUrl = `${baseUrl}/subscription-success.html?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${baseUrl}/bracket-games.html?subscribe=canceled`;

  const form = new URLSearchParams();
  form.set('mode', 'subscription');
  form.set('success_url', successUrl);
  form.set('cancel_url', cancelUrl);
  form.set('client_reference_id', String(user.id));
  form.set('customer_email', String(user.email || ''));
  form.set('metadata[user_id]', String(user.id));
  form.set('metadata[user_email]', String(user.email || ''));
  form.set('line_items[0][price]', priceId);
  form.set('line_items[0][quantity]', '1');
  form.set('allow_promotion_codes', 'true');

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method:'POST',
    headers:{
      'Authorization': `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: form.toString()
  });

  const data = await res.json().catch(()=>null);
  if(!res.ok){
    return json({ ok:false, error:'stripe_checkout_failed', detail:data }, 500);
  }
  return json({ ok:true, url:data.url, session_id:data.id });
}

export async function onRequest(){
  return json({ ok:false, error:'Method not allowed' }, 405);
}
