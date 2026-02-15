import { json, requireUser } from "./_util.js";

export async function onRequestGet({ request, env }){
  const user = await requireUser({request, env});
  if(!user) return json({ok:false, error:"Not logged in."}, 401);

  const url = new URL(request.url);
  const bracketId = String(url.searchParams.get("bracket_id") || "");
  if(!bracketId) return json({ok:false, error:"Missing bracket id."}, 400);

  const row = await env.DB.prepare(
    "SELECT id, status FROM feature_requests WHERE bracket_id=? AND user_id=? ORDER BY created_at DESC LIMIT 1"
  ).bind(bracketId, user.id).first();

  return json({ok:true, submitted: !!row, status: row ? row.status : null});
}
