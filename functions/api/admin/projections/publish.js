import { json, requireAdmin } from "../../_util.js";

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

export async function onRequestPost({ request, env }){
  await ensureTables(env);

  const admin = await requireAdmin(request, env);
  if(!admin) return json({ ok:false, error:"Unauthorized" }, 401);

  let body = {};
  try{ body = await request.json(); }catch(e){}
  const label = (body.label || "").slice(0, 120);
  const snapshot = body.snapshot;

  if(!snapshot || !snapshot.east || !snapshot.west || !snapshot.midwest || !snapshot.south){
    return json({ ok:false, error:"Missing snapshot (east/west/midwest/south)" }, 400);
  }

  const regions = ["east","west","midwest","south"];
  for(const r of regions){
    const arr = snapshot[r];
    if(!Array.isArray(arr) || arr.length !== 16) return json({ ok:false, error:`Invalid ${r} (must be 16)` }, 400);
    const seeds = new Set(arr.map(x=>x.seed));
    for(let s=1;s<=16;s++) if(!seeds.has(s)) return json({ ok:false, error:`${r} missing seed ${s}` }, 400);
    for(const x of arr){
      if(!x.team || !String(x.team).trim()) return json({ ok:false, error:`${r} seed ${x.seed} is blank` }, 400);
    }
  }

  const snapJson = JSON.stringify(snapshot);
  const ins = await env.DB.prepare("INSERT INTO projection_versions (label, snapshot_json) VALUES (?, ?)").bind(label, snapJson).run();
  const newId = ins.meta && ins.meta.last_row_id ? ins.meta.last_row_id : null;

  if(!newId) return json({ ok:false, error:"Failed to create version" }, 500);

  await env.DB.prepare("INSERT INTO app_config (key, value) VALUES ('current_projection_version_id', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(String(newId)).run();

  return json({ ok:true, id:newId });
}
