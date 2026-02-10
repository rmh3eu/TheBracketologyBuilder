import { json, getCookie, setCookie } from "./_util.js";

export async function onRequestPost({ request, env }){
  if(!env || !env.SESSIONS) return json({ok:false, error:"MISSING_SESSIONS", message:"Server missing KV binding 'SESSIONS'."}, 500);

  const token = getCookie(request, "bb_sess");
  if(token && env && env.SESSIONS) await env.SESSIONS.delete("sess:"+token);
  const cookie = setCookie("bb_sess", "", { maxAge: 0 });
  return json({ok:true}, 200, { "Set-Cookie": cookie });
}
