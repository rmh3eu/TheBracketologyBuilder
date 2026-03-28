import { json, requireUser, isAdmin } from "../_util.js";

async function ensureBracketsSchema(env){
  const add = async (sql) => { try{ await env.DB.prepare(sql).run(); }catch(_e){} };
  await add("ALTER TABLE brackets ADD COLUMN bracket_type TEXT NOT NULL DEFAULT 'bracketology'");
  await add("ALTER TABLE brackets ADD COLUMN bracket_name TEXT");
  await add("ALTER TABLE brackets ADD COLUMN data_json TEXT");
  await add("ALTER TABLE brackets ADD COLUMN payload TEXT");
}

function isEditablePickKey(key){
  const k = String(key || "");
  if(k === "CHAMPION" || k === "FINAL__winner" || k === "TIEBREAKER_TOTAL") return true;
  if(k.endsWith("__winner")) return true;
  return false;
}

function sanitizeTeamPick(value){
  if(value === null || value === undefined || value === "") return null;
  if(typeof value === "string") return value.trim() ? value : null;
  if(typeof value !== "object") return null;
  const out = {};
  if(value.seed !== undefined && value.seed !== null && value.seed !== ""){
    const seedNum = Number(value.seed);
    out.seed = Number.isFinite(seedNum) ? seedNum : value.seed;
  }
  if(value.name !== undefined && value.name !== null){
    out.name = String(value.name).trim();
  }
  if(value.region !== undefined && value.region !== null && String(value.region).trim()) out.region = String(value.region).trim();
  if(value.id !== undefined && value.id !== null && String(value.id).trim()) out.id = String(value.id).trim();
  if(!out.name && out.seed === undefined) return null;
  return out;
}

function sanitizePicks(input){
  const raw = (input && typeof input === 'object' && !Array.isArray(input)) ? input : {};
  const out = {};
  for(const [key, value] of Object.entries(raw)){
    if(!isEditablePickKey(key)) continue;
    if(key === 'TIEBREAKER_TOTAL'){
      if(value === null || value === undefined || value === '') continue;
      const n = Number(value);
      if(Number.isFinite(n)) out[key] = Math.max(0, Math.round(n));
      continue;
    }
    const clean = sanitizeTeamPick(value);
    if(clean) out[key] = clean;
  }
  if(out.CHAMPION && !out['FINAL__winner']) out['FINAL__winner'] = out.CHAMPION;
  if(out['FINAL__winner']) out.CHAMPION = out['FINAL__winner'];
  return out;
}

function extractPicks(data){
  const root = (data && typeof data === 'object') ? data : {};
  if(root.picks && typeof root.picks === 'object' && !Array.isArray(root.picks)) return root.picks;
  if(root.data && root.data.picks && typeof root.data.picks === 'object' && !Array.isArray(root.data.picks)) return root.data.picks;
  const flat = {};
  for(const [key, value] of Object.entries(root)){
    if(isEditablePickKey(key)) flat[key] = value;
  }
  return flat;
}

function applyPicksPreservingShape(existingData, nextPicks){
  const data = (existingData && typeof existingData === 'object') ? structuredClone(existingData) : {};
  if(data.picks && typeof data.picks === 'object' && !Array.isArray(data.picks)){
    data.picks = nextPicks;
    return data;
  }
  if(data.data && data.data.picks && typeof data.data.picks === 'object' && !Array.isArray(data.data.picks)){
    data.data = { ...data.data, picks: nextPicks };
    return data;
  }
  for(const key of Object.keys(data)){
    if(isEditablePickKey(key)) delete data[key];
  }
  Object.assign(data, nextPicks);
  return data;
}

export async function onRequestGet({ request, env }){
  const user = await requireUser({ request, env });
  if(!isAdmin(user, env)) return json({ ok:false, error:'Not authorized.' }, 403);
  await ensureBracketsSchema(env);

  const url = new URL(request.url);
  const id = String(url.searchParams.get('id') || '').trim();
  if(!id) return json({ ok:false, error:'Missing id.' }, 400);

  const row = await env.DB.prepare(
    `SELECT b.id, b.user_id, u.email AS user_email, b.title, b.bracket_type, b.data_json, b.created_at, b.updated_at
       FROM brackets b
       LEFT JOIN users u ON u.id = b.user_id
      WHERE b.id=?`
  ).bind(id).first();

  if(!row) return json({ ok:false, error:'Not found.' }, 404);

  let data = {};
  try{ data = JSON.parse(row.data_json || '{}'); }catch(_e){ data = {}; }
  const picks = extractPicks(data);
  return json({
    ok:true,
    bracket: {
      id: row.id,
      title: row.title || 'Untitled Bracket',
      bracket_type: row.bracket_type || 'bracketology',
      user_id: row.user_id,
      user_email: row.user_email || '',
      created_at: row.created_at,
      updated_at: row.updated_at,
      picks,
      has_nested_picks: !!(data && data.picks && typeof data.picks === 'object' && !Array.isArray(data.picks))
    }
  });
}

export async function onRequestPost({ request, env }){
  const user = await requireUser({ request, env });
  if(!isAdmin(user, env)) return json({ ok:false, error:'Not authorized.' }, 403);
  await ensureBracketsSchema(env);

  const body = await request.json().catch(()=>({}));
  const id = String(body.id || '').trim();
  if(!id) return json({ ok:false, error:'Missing id.' }, 400);
  if(!body || typeof body.picks !== 'object' || Array.isArray(body.picks)) return json({ ok:false, error:'Missing picks object.' }, 400);

  const row = await env.DB.prepare(`SELECT id, data_json FROM brackets WHERE id=?`).bind(id).first();
  if(!row) return json({ ok:false, error:'Not found.' }, 404);

  let existingData = {};
  try{ existingData = JSON.parse(row.data_json || '{}'); }catch(_e){ existingData = {}; }

  const nextPicks = sanitizePicks(body.picks);
  const nextData = applyPicksPreservingShape(existingData, nextPicks);
  const now = new Date().toISOString();
  await env.DB.prepare(`UPDATE brackets SET data_json=?, updated_at=? WHERE id=?`).bind(JSON.stringify(nextData), now, id).run();

  return json({ ok:true, updated:true, updated_at: now, picks: nextPicks });
}
