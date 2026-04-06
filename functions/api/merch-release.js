import { json } from './_util.js';
import { releaseHold } from './_merch.js';

export async function onRequestPost({ request, env }){
  const body = await request.json().catch(() => ({}));
  const sessionId = String(body.sessionId || '').trim();
  if(!sessionId) return json({ ok:false, error:'missing_session_id' }, 400);
  const result = await releaseHold(env, sessionId);
  return json({ ok:true, ...result });
}
