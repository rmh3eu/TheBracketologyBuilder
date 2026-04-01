import { json, requireUser, isAdmin, ensureUserSchema } from "./_util.js";

function hasActiveGamesSubscription(user){
  if(!user) return false;
  const status = String(user.games_subscription_status || '').toLowerCase();
  if(status !== 'active') return false;
  const ends = String(user.games_subscription_ends_at || '').trim();
  if(!ends) return true;
  const ts = Date.parse(ends);
  return Number.isFinite(ts) ? (Date.now() < ts) : true;
}

export async function onRequestGet({ request, env }){
  await ensureUserSchema(env);
  const user = await requireUser({request, env});
  if(!user) return json({ok:true, user:null});
  return json({ok:true, user:{id:user.id, email:user.email, isAdmin:isAdmin(user, env), games_subscription_active: hasActiveGamesSubscription(user), games_subscription_status: String(user.games_subscription_status || ''), games_subscription_started_at: user.games_subscription_started_at || null, games_subscription_ends_at: user.games_subscription_ends_at || null}});
}
