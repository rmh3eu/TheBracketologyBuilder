import { json, requireUser, isAdmin } from "./_util.js";

export async function onRequestGet({ request, env }){
  const user = await requireUser({request, env});
  if(!user) return json({ok:true, user:null});
  return json({ok:true, user:{id:user.id, email:user.email, isAdmin:isAdmin(user, env)}});
}
