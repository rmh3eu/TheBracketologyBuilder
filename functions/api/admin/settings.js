
import { json, requireUser, isAdmin } from "../_util.js";

async function ensureTables(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value_text TEXT
  )`).run();
}

export async function onRequestGet({ request, env }){
  const user = await requireUser({request, env});
  if(!isAdmin(user, env)) return json({ok:false, error:"Not authorized."}, 403);
  await ensureTables(env);
  const rs = await env.DB.prepare("SELECT key, value_text FROM site_settings").all();
  const settings = {};
  for(const r of (rs.results||[])) settings[r.key]=r.value_text;
  return json({ok:true, settings});
}

export async function onRequestPost({ request, env }){
  const user = await requireUser({request, env});
  if(!isAdmin(user, env)) return json({ok:false, error:"Not authorized."}, 403);
  await ensureTables(env);
  const body = await request.json();
  const key = String(body.key||"").trim();
  const value = body.value===undefined||body.value===null? "" : String(body.value);
  if(!key) return json({ok:false, error:"Missing key."}, 400);
  await env.DB.prepare("INSERT INTO site_settings (key, value_text) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value_text=excluded.value_text")
    .bind(key, value).run();
  return json({ok:true});
}
