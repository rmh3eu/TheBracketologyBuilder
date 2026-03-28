import { json, requireUser, isAdmin } from "../_util.js";

async function ensureBracketsSchema(env){
  const add = async (sql) => { try{ await env.DB.prepare(sql).run(); }catch(_e){} };
  await add("ALTER TABLE brackets ADD COLUMN bracket_type TEXT NOT NULL DEFAULT 'bracketology'");
  await add("ALTER TABLE brackets ADD COLUMN bracket_name TEXT");
  await add("ALTER TABLE brackets ADD COLUMN data_json TEXT");
  await add("ALTER TABLE brackets ADD COLUMN payload TEXT");
  try{ await env.DB.prepare("CREATE INDEX IF NOT EXISTS brackets_updated_idx ON brackets(updated_at)").run(); }catch(_e){}
}

function isPickKey(key){
  return key === 'CHAMPION' || key === 'TIEBREAKER_TOTAL' || /__winner$/.test(String(key || ''));
}

function extractPicks(data){
  if(data && typeof data === 'object' && data.picks && typeof data.picks === 'object') return data.picks;
  const out = {};
  for(const [k,v] of Object.entries(data || {})){
    if(isPickKey(k)) out[k] = v;
  }
  return out;
}

function applyPicksPreservingShape(data, newPicks){
  const source = (data && typeof data === 'object') ? data : {};
  if(source.picks && typeof source.picks === 'object'){
    return { ...source, picks: newPicks };
  }
  const out = {};
  for(const [k,v] of Object.entries(source)){
    if(!isPickKey(k)) out[k] = v;
  }
  for(const [k,v] of Object.entries(newPicks || {})){
    out[k] = v;
  }
  return out;
}

export async function onRequestGet({ request, env }){
  const user = await requireUser({ request, env });
  if(!isAdmin(user, env)) return json({ ok:false, error:"Not authorized." }, 403);

  await ensureBracketsSchema(env);

  const url = new URL(request.url);
  const limitRaw = parseInt(url.searchParams.get('limit') || '100', 10);
  const offsetRaw = parseInt(url.searchParams.get('offset') || '0', 10);
  const limit = Math.max(1, Math.min(200, isFinite(limitRaw) ? limitRaw : 100));
  const offset = Math.max(0, isFinite(offsetRaw) ? offsetRaw : 0);

  const bracketId = (url.searchParams.get('id') || '').trim();
  if(bracketId){
    const row = await env.DB.prepare(
      `SELECT b.id, b.user_id, u.email as user_email, b.title, b.bracket_type, b.created_at, b.updated_at, b.data_json
         FROM brackets b
         JOIN users u ON u.id = b.user_id
        WHERE b.id = ?`
    ).bind(bracketId).first();
    if(!row) return json({ ok:false, error:'Bracket not found.' }, 404);
    let data = {};
    try{ data = JSON.parse(row.data_json || '{}'); }catch(_e){ data = {}; }
    return json({ ok:true, bracket: { ...row, picks: extractPicks(data) } });
  }

  const rs = await env.DB.prepare(
    `SELECT b.id,
            b.user_id,
            u.email as user_email,
            b.title,
            b.bracket_type,
            b.created_at,
            b.updated_at
       FROM brackets b
       JOIN users u ON u.id = b.user_id
      ORDER BY COALESCE(b.updated_at, b.created_at) DESC
      LIMIT ? OFFSET ?`
  ).bind(limit, offset).all();

  return json({ ok:true, brackets: rs.results || [] });
}

export async function onRequestPost({ request, env }){
  const user = await requireUser({ request, env });
  if(!isAdmin(user, env)) return json({ ok:false, error:"Not authorized." }, 403);

  await ensureBracketsSchema(env);

  let body = {};
  try{ body = await request.json(); }catch(_e){}
  const bracketId = String(body?.id || '').trim();
  const newPicks = body?.picks;
  if(!bracketId) return json({ ok:false, error:'Missing bracket id.' }, 400);
  if(!newPicks || typeof newPicks !== 'object' || Array.isArray(newPicks)) return json({ ok:false, error:'Invalid picks payload.' }, 400);

  const row = await env.DB.prepare(`SELECT id, data_json FROM brackets WHERE id = ?`).bind(bracketId).first();
  if(!row) return json({ ok:false, error:'Bracket not found.' }, 404);

  let data = {};
  try{ data = JSON.parse(row.data_json || '{}'); }catch(_e){ data = {}; }
  const updated = applyPicksPreservingShape(data, newPicks);

  await env.DB.prepare(`UPDATE brackets SET data_json = ?, updated_at = ? WHERE id = ?`)
    .bind(JSON.stringify(updated), new Date().toISOString(), bracketId)
    .run();

  return json({ ok:true });
}
