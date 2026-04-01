import { json, requireUser, isAdmin } from "./_util.js";

export async function onRequestGet({ request, env }){
  const user = await requireUser({request, env});
  if(!user) return json({ok:true, user:null});
  return json({ok:true, user:{
    id:user.id,
    email:user.email,
    isAdmin:isAdmin(user, env),
    games_subscription_status: user.games_subscription_status || 'none',
    games_subscription_started_at: user.games_subscription_started_at || null,
    games_subscription_ends_at: user.games_subscription_ends_at || null,
    has_games_subscription: !!(user.games_subscription_status === 'active' && (!user.games_subscription_ends_at || Date.parse(user.games_subscription_ends_at) > Date.now()))
  }});
}
