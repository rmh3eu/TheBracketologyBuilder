import { json } from "./_util.js";

async function ensureTables(env){
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS projection_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      label TEXT DEFAULT '',
      snapshot_json TEXT NOT NULL
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `).run();
}

export async function onRequestGet({ env }){
  await ensureTables(env);
  const row = await env.DB.prepare("SELECT value FROM app_config WHERE key='current_projection_version_id'").first();
  if(!row) return json({ ok:true, current:null });

  const id = parseInt(row.value, 10);
  if(!id) return json({ ok:true, current:null });

  const v = await env.DB.prepare("SELECT id, created_at, label, snapshot_json FROM projection_versions WHERE id=?").bind(id).first();
  if(!v) return json({ ok:true, current:null });

  let snapshot = null;
  try{ snapshot = JSON.parse(v.snapshot_json); }catch(e){ snapshot = null; }
  return json({ ok:true, current:{ id:v.id, created_at:v.created_at, label:v.label || '', snapshot } });
}
