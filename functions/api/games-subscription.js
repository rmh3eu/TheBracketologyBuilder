import { json, requireUser, ensureUserSchema, isAdmin } from "./_util.js";

const PAYMENT_URL = '/api/create-checkout-session';

function isActive(row){
  if(!row) return false;
  const status = String(row.games_subscription_status || '').toLowerCase();
  if(status !== 'active') return false;
  const ends = String(row.games_subscription_ends_at || '').trim();
  if(!ends) return true;
  const ts = Date.parse(ends);
  return Number.isFinite(ts) ? (Date.now() < ts) : true;
}

export async function onRequest(context){
  const { request, env } = context;
  await ensureUserSchema(env);
  const user = await requireUser({ request, env });

  if(request.method === 'GET'){
    if(!user) return json({ ok:true, active:false, payment_url: PAYMENT_URL, checkout_mode: 'stripe' });
    const row = await env.DB.prepare(`SELECT games_subscription_status, games_subscription_started_at, games_subscription_ends_at FROM users WHERE id=?`).bind(user.id).first();
    return json({ ok:true, active:isActive(row), status:String((row&&row.games_subscription_status)||''), started_at:row&&row.games_subscription_started_at||null, ends_at:row&&row.games_subscription_ends_at||null, payment_url: PAYMENT_URL, checkout_mode: 'stripe' });
  }

  if(request.method === 'POST'){
    if(!user || !isAdmin(user, env)) return json({ ok:false, error:'Unauthorized' }, 401);
    const body = await request.json().catch(()=>null) || {};
    const email = String(body.email || '').trim().toLowerCase();
    const status = String(body.status || '').trim().toLowerCase();
    const ends_at = body.ends_at ? String(body.ends_at) : null;
    if(!email) return json({ ok:false, error:'Missing email' }, 400);
    if(!['active','inactive','canceled',''].includes(status)) return json({ ok:false, error:'Invalid status' }, 400);
    const now = new Date().toISOString();
    await env.DB.prepare(`UPDATE users SET games_subscription_status=?, games_subscription_started_at=CASE WHEN ?='active' THEN COALESCE(games_subscription_started_at, ?) ELSE games_subscription_started_at END, games_subscription_ends_at=? WHERE lower(email)=?`).bind(status, status, now, ends_at, email).run();
    return json({ ok:true });
  }

  return json({ ok:false, error:'Method not allowed' }, 405);
}
