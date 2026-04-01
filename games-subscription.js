import { json, requireUser, isAdmin, ensureUserSchema } from "./_util.js";

function buildStatus(user){
  const status = user?.games_subscription_status || 'none';
  const endsAt = user?.games_subscription_ends_at || null;
  const active = !!(status === 'active' && (!endsAt || Date.parse(endsAt) > Date.now()));
  return {
    status,
    active,
    started_at: user?.games_subscription_started_at || null,
    ends_at: endsAt
  };
}

export async function onRequestGet({ request, env }){
  await ensureUserSchema(env);
  const user = await requireUser({request, env});
  const checkout_url = env.GAMES_SUBSCRIPTION_CHECKOUT_URL || '/tickets.html';
  if(!user) return json({ ok:true, user:null, subscription:{ status:'none', active:false, started_at:null, ends_at:null }, checkout_url, monthly_price:'5.99' });
  return json({ ok:true, user:{ id:user.id, email:user.email, isAdmin:isAdmin(user, env) }, subscription: buildStatus(user), checkout_url, monthly_price:'5.99' });
}

export async function onRequestPost({ request, env }){
  await ensureUserSchema(env);
  const admin = await requireUser({request, env});
  if(!admin || !isAdmin(admin, env)) return json({ ok:false, error:'ADMIN_REQUIRED' }, 403);
  const body = await request.json().catch(()=>({}));
  const email = String(body.email || '').trim().toLowerCase();
  const action = String(body.action || 'activate');
  if(!email) return json({ ok:false, error:'EMAIL_REQUIRED' }, 400);
  const user = await env.DB.prepare('SELECT * FROM users WHERE lower(email)=lower(?)').bind(email).first();
  if(!user) return json({ ok:false, error:'USER_NOT_FOUND' }, 404);
  const now = new Date();
  let status = 'none';
  let startedAt = null;
  let endsAt = null;
  if(action === 'activate'){
    status = 'active';
    startedAt = now.toISOString();
    const end = new Date(now.getTime());
    end.setMonth(end.getMonth() + 1);
    endsAt = end.toISOString();
  }
  await env.DB.prepare('UPDATE users SET games_subscription_status=?, games_subscription_started_at=?, games_subscription_ends_at=? WHERE id=?').bind(status, startedAt, endsAt, user.id).run();
  return json({ ok:true, email, subscription:{ status, active: status === 'active', started_at: startedAt, ends_at: endsAt } });
}
