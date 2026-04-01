import { json, requireUser, isAdmin, ensureUserSchema } from "./_util.js";

async function ensureGamesSubscriptionSchema(env){
  await ensureUserSchema(env);
  const add = async (sql) => { try{ await env.DB.prepare(sql).run(); }catch(e){} };
  await add("ALTER TABLE users ADD COLUMN games_subscription_status TEXT");
  await add("ALTER TABLE users ADD COLUMN games_subscription_started_at TEXT");
  await add("ALTER TABLE users ADD COLUMN games_subscription_ends_at TEXT");
}

export async function onRequestGet({ request, env }){
  await ensureGamesSubscriptionSchema(env);
  const user = await requireUser({request, env});
  if(!user) return json({ok:true, user:null});
  const full = await env.DB.prepare("SELECT id,email, games_subscription_status, games_subscription_started_at, games_subscription_ends_at FROM users WHERE id=?").bind(user.id).first();
  return json({ok:true, user:{id:full.id, email:full.email, isAdmin:isAdmin(full, env), games_subscription_status: full.games_subscription_status || '', games_subscription_started_at: full.games_subscription_started_at || null, games_subscription_ends_at: full.games_subscription_ends_at || null}});
}
