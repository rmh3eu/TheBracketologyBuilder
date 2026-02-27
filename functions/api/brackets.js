import { json, requireUser, uid } from "./_util.js";




async function ensureBracketsSchema(env){
  // Defensive schema/migration so /api/brackets works across older DB shapes.
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS brackets (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      userId TEXT,
      title TEXT,
      bracket_name TEXT,
      bracketName TEXT,
      data_json TEXT,
      payload TEXT,
      bracket_type TEXT,
      created_at TEXT,
      updated_at TEXT,
      projection_version_id INTEGER
    )
  `).run();

  // Helpful index (best-effort)
  try{ await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_brackets_user ON brackets(user_id)`).run(); }catch(e){}

  const info = await env.DB.prepare("PRAGMA table_info(brackets)").all();
  const cols = new Set((info.results||[]).map(r=>r.name));

  const addCol = async (name, typeSql)=>{
    if(cols.has(name)) return;
    try{ await env.DB.prepare(`ALTER TABLE brackets ADD COLUMN ${name} ${typeSql}`).run(); }catch(e){}
  };

  // Common columns across builds
  await addCol('user_id','TEXT');
  await addCol('userId','TEXT');
  await addCol('title','TEXT');
  await addCol('bracket_name','TEXT');
  await addCol('bracketName','TEXT');
  await addCol('data_json','TEXT');
  await addCol('payload','TEXT');
  await addCol('bracket_type','TEXT');
  await addCol('created_at','TEXT');
  await addCol('updated_at','TEXT');
  await addCol('projection_version_id','INTEGER');

  // Backfill user_id/title/data_json from legacy columns when possible
  try{ await env.DB.prepare("UPDATE brackets SET user_id = COALESCE(user_id, userId) WHERE user_id IS NULL OR user_id=''").run(); }catch(e){}
  try{ await env.DB.prepare("UPDATE brackets SET title = COALESCE(title, bracket_name, bracketName) WHERE title IS NULL OR title=''").run(); }catch(e){}
  try{ await env.DB.prepare("UPDATE brackets SET bracket_name = COALESCE(bracket_name, bracketName, title) WHERE bracket_name IS NULL OR bracket_name=''").run(); }catch(e){}
  try{ await env.DB.prepare("UPDATE brackets SET data_json = COALESCE(data_json, payload) WHERE data_json IS NULL OR data_json=''").run(); }catch(e){}
  try{ await env.DB.prepare("UPDATE brackets SET created_at = COALESCE(created_at, datetime('now')) WHERE created_at IS NULL OR created_at=''").run(); }catch(e){}
  try{ await env.DB.prepare("UPDATE brackets SET updated_at = COALESCE(updated_at, created_at) WHERE updated_at IS NULL OR updated_at=''").run(); }catch(e){}

  // Featured requests table used by My Brackets badges / admin review.
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS feature_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bracket_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    )
  `).run();
  try{ await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_feature_requests_bracket ON feature_requests(bracket_id)`).run(); }catch(e){}
}

async function ensureProjectionTables(env){
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

async function ensureBracketHasProjectionColumn(env){
  // Add projection_version_id column if missing
  const info = await env.DB.prepare("PRAGMA table_info(brackets)").all();
  const cols = new Set((info.results||[]).map(r=>r.name));
  if(!cols.has("projection_version_id")){
    try{
      await env.DB.prepare("ALTER TABLE brackets ADD COLUMN projection_version_id INTEGER").run();
    }catch(e){
      // ignore if cannot alter
    }
  }
}

async function getCurrentProjectionVersion(env){
  await ensureProjectionTables(env);
  const row = await env.DB.prepare("SELECT value FROM app_config WHERE key='current_projection_version_id'").first();
  if(!row) return null;
  const id = parseInt(row.value, 10);
  if(!id) return null;
  const v = await env.DB.prepare("SELECT id, snapshot_json FROM projection_versions WHERE id=?").bind(id).first();
  if(!v) return null;
  try{
    return { id: v.id, snapshot: JSON.parse(v.snapshot_json) };
  }catch(e){
    return null;
  }
}

function snapshotToBase(snapshot){
  // Convert {east:[{seed,team}],...} to legacy base shape used in your renderer: {EAST:[[seed,team],...],...}
  if(!snapshot) return null;
  const toPairs = (arr)=> (arr||[]).map(x=>[x.seed, x.team]);
  return {
    EAST: toPairs(snapshot.east),
    WEST: toPairs(snapshot.west),
    MIDWEST: toPairs(snapshot.midwest),
    SOUTH: toPairs(snapshot.south),
  };
}

export async function onRequest(context){
  const { request, env } = context;
  const user = await requireUser(request, env);
  if(!user) return json({ ok:false, error:'Unauthorized' }, 401);

  await ensureBracketsSchema(env);

  if(request.method === 'GET'){
    // Return ALL brackets for this user (no phase filtering, no date filtering).
    const rs = await env.DB.prepare(
      `SELECT id,
              COALESCE(user_id, userId) AS user_id,
              title,
              bracket_name,
              bracket_type,
              created_at,
              updated_at,
              (
                SELECT fr.status
                  FROM feature_requests fr
                 WHERE fr.bracket_id = brackets.id
                   AND fr.user_id = COALESCE(brackets.user_id, brackets.userId)
                 ORDER BY fr.created_at DESC
                 LIMIT 1
              ) AS feature_status
         FROM brackets
        WHERE COALESCE(user_id, userId)=?
        ORDER BY COALESCE(updated_at, created_at) DESC`
    ).bind(user.id).all();

    return json({ ok:true, brackets: rs.results || [] });
  }

  if(request.method === 'POST'){
    const body = await request.json().catch(()=>null) || {};

    // Ensure optional projection_version_id column exists (older DBs)
    await ensureBracketHasProjectionColumn(env);
    const cur = await getCurrentProjectionVersion(env);

    const desiredTitle = String(body.title || body.bracket_name || '').trim().slice(0, 80);
    const title = desiredTitle || 'My Bracket';
    const bracket_type = normalizeType(body.bracket_type);

    // Data payload may arrive as `data` (newer builds) or `payload` (older builds)
    const data = (body && Object.prototype.hasOwnProperty.call(body, 'data')) ? body.data : null;
    const payload = (body && Object.prototype.hasOwnProperty.call(body, 'payload')) ? body.payload : null;

    // Prevent duplicate bracket names for the SAME user (across all types).
    const dupe = await env.DB.prepare(
      `SELECT id FROM brackets WHERE COALESCE(user_id, userId)=? AND title=? LIMIT 1`
    ).bind(user.id, title).first();
    if(dupe) return json({ ok:false, error:'NAME_TAKEN', message:'You already have a bracket with that name.' }, 409);

    const id = uid();
    const now = new Date().toISOString();

    // Prefer storing picks in data_json. Also store legacy payload for backward compatibility.
// CRITICAL: freeze a base snapshot at creation time so brackets NEVER drift when projections change.
let dataObj = (data !== null) ? data : ((payload !== null) ? payload : {});
if(!dataObj || typeof dataObj !== 'object') dataObj = {};
if(!dataObj.base){
  if(cur && cur.snapshot){
    const base = snapshotToBase(cur.snapshot);
    if(base) dataObj.base = base;
    dataObj.projection_version_id = cur.id;
  } else {
    dataObj.base = CURRENT_SNAPSHOT;
  }
}

const data_json = JSON.stringify(dataObj);
const legacy_payload = JSON.stringify(dataObj);

    await env.DB.prepare(
      `INSERT INTO brackets (id, user_id, title, bracket_name, data_json, payload, bracket_type, created_at, updated_at, projection_version_id)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      id,
      user.id,
      title,
      title,
      data_json,
      legacy_payload,
      bracket_type,
      now,
      now,
      (dataObj && dataObj.projection_version_id) ? dataObj.projection_version_id : null
    ).run();

    return json({ ok:true, id });
  }

  return json({ ok:false, error:'Method not allowed' }, 405);
}