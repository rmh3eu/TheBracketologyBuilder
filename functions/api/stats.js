
import { json } from "./_util.js";

async function ensureTables(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value_text TEXT
  )`).run();
}

export async function onRequestGet({ request, env }){
  await ensureTables(env);
  // total brackets cached in KV for speed; fallback to D1
  let total = null;
  try{
    const v = await env.SESSIONS.get("STATS:total_brackets");
    if(v!==null) total = Number(v);
  }catch(e){}

  if(total===null || !Number.isFinite(total)){
    const rs = await env.DB.prepare("SELECT COUNT(*) as c FROM brackets").first();
    total = Number(rs && rs.c || 0);
    try{ await env.SESSIONS.put("STATS:total_brackets", String(total)); }catch(e){}
  }

  const setting = await env.DB.prepare("SELECT value_text FROM site_settings WHERE key='show_total_brackets'").first();
  const show = setting ? (setting.value_text==="1" || setting.value_text==="true") : false;

  return json({ok:true, total_brackets: total, show_total_brackets: show});
}
