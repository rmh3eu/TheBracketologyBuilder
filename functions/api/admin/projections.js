import { json, requireAdmin } from "../_util.js";

async function ensureTables(env){
  // projection_versions stores snapshots, app_config stores current pointer
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

async function getCurrent(env){
  const row = await env.DB.prepare("SELECT value FROM app_config WHERE key='current_projection_version_id'").first();
  if(!row) return null;
  const id = parseInt(row.value, 10);
  if(!id) return null;
  const v = await env.DB.prepare("SELECT id, created_at, label FROM projection_versions WHERE id=?").bind(id).first();
  return v || null;
}

export async function onRequest({ request, env }){
  await ensureTables(env);

  const admin = await requireAdmin(request, env);
  if(!admin) return json({ ok:false, error:"Unauthorized" }, 401);

  const url = new URL(request.url);
  const path = url.pathname;

  if(request.method === "GET"){
    const versions = await env.DB.prepare("SELECT id, created_at, label FROM projection_versions ORDER BY id DESC LIMIT 50").all();
    const current = await getCurrent(env);
    return json({ ok:true, current, versions: versions.results || [] });
  }

  if(request.method === "POST" && path.endsWith("/publish")){
    let body = {};
    try{ body = await request.json(); }catch(e){}
    const label = (body.label || "").slice(0, 120);
    const snapshot = body.snapshot;

    if(!snapshot || !snapshot.east || !snapshot.west || !snapshot.midwest || !snapshot.south){
      return json({ ok:false, error:"Missing snapshot (east/west/midwest/south)" }, 400);
    }

    // minimal validation: 16 teams each region, seeds 1-16
    const regions = ["east","west","midwest","south"];
    for(const r of regions){
      const arr = snapshot[r];
      if(!Array.isArray(arr) || arr.length !== 16) return json({ ok:false, error:`Invalid ${r} (must be 16)` }, 400);
      const seeds = new Set(arr.map(x=>x.seed));
      for(let s=1;s<=16;s++) if(!seeds.has(s)) return json({ ok:false, error:`${r} missing seed ${s}` }, 400);
    }

    const snapJson = JSON.stringify(snapshot);
    const ins = await env.DB.prepare("INSERT INTO projection_versions (label, snapshot_json) VALUES (?, ?)").bind(label, snapJson).run();
    const newId = ins.meta && ins.meta.last_row_id ? ins.meta.last_row_id : null;

    if(!newId) return json({ ok:false, error:"Failed to create version" }, 500);

    // set current pointer
    await env.DB.prepare("INSERT INTO app_config (key, value) VALUES ('current_projection_version_id', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(String(newId)).run();

    return json({ ok:true, id:newId });
  }

  return json({ ok:false, error:"Not found" }, 404);
}
