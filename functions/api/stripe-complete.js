
import { json, requireUser, ensureUserSchema } from "./_util.js";

function normalizeStatus(subscription, session){
  const subStatus = String(subscription?.status || '').toLowerCase();
  if(['active','trialing'].includes(subStatus)) return 'active';
  const sessionStatus = String(session?.payment_status || '').toLowerCase();
  if(sessionStatus === 'paid') return 'active';
  return subStatus || sessionStatus || '';
}

export async function onRequestGet({ request, env }){
  await ensureUserSchema(env);
  const user = await requireUser({ request, env });
  if(!user) return json({ ok:false, error:'signin_required' }, 401);

  const secret = String(env.STRIPE_SECRET_KEY || '').trim();
  if(!secret) return json({ ok:false, error:'missing_stripe_secret_key' }, 500);

  const url = new URL(request.url);
  const sessionId = String(url.searchParams.get('session_id') || '').trim();
  if(!sessionId) return json({ ok:false, error:'missing_session_id' }, 400);

  const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription`, {
    headers:{ 'Authorization': `Bearer ${secret}` }
  });
  const session = await stripeRes.json().catch(()=>null);
  if(!stripeRes.ok) return json({ ok:false, error:'stripe_lookup_failed', detail:session }, 500);

  const linkedUserId = String(session?.metadata?.user_id || session?.client_reference_id || '').trim();
  const linkedEmail = String(session?.metadata?.user_email || session?.customer_details?.email || '').trim().toLowerCase();
  const currentUserId = String(user.id);
  const currentEmail = String(user.email || '').trim().toLowerCase();
  if(linkedUserId && linkedUserId !== currentUserId && linkedEmail && linkedEmail !== currentEmail){
    return json({ ok:false, error:'session_user_mismatch' }, 403);
  }

  const subscription = session?.subscription || null;
  const normalized = normalizeStatus(subscription, session);
  const active = normalized === 'active';
  if(!active){
    return json({ ok:false, error:'subscription_not_active', status: normalized || null, stripe_session: sessionId }, 400);
  }

  let startedAt = new Date().toISOString();
  let endsAt = null;
  if(subscription?.current_period_start){
    startedAt = new Date(subscription.current_period_start * 1000).toISOString();
  }
  if(subscription?.current_period_end){
    endsAt = new Date(subscription.current_period_end * 1000).toISOString();
  }

  await env.DB.prepare(`
    UPDATE users
       SET games_subscription_status = 'active',
           games_subscription_started_at = COALESCE(games_subscription_started_at, ?),
           games_subscription_ends_at = ?
     WHERE id = ?
  `).bind(startedAt, endsAt, user.id).run();

  return json({ ok:true, active:true, started_at:startedAt, ends_at:endsAt, session_id: sessionId });
}

export async function onRequest(){
  return json({ ok:false, error:'Method not allowed' }, 405);
}
