import { json, requireUser, uid } from "./_util.js";


async function ensureBracketsSchema(env){
  const add = async (sql) => { try{ await env.DB.prepare(sql).run(); }catch(_e){} };

  // Create base table (widest shape)
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS brackets (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT,
      bracket_name TEXT,
      data_json TEXT,
      payload TEXT,
      bracket_type TEXT,
      created_at TEXT,
      updated_at TEXT,
      projection_version_id INTEGER
    )
  `).run();

  // Add legacy/optional columns if missing (best-effort)
  await add("ALTER TABLE brackets ADD COLUMN user_id TEXT");
  await add("ALTER TABLE brackets ADD COLUMN userId TEXT");
  await add("ALTER TABLE brackets ADD COLUMN title TEXT");
  await add("ALTER TABLE brackets ADD COLUMN bracket_name TEXT");
  await add("ALTER TABLE brackets ADD COLUMN bracketName TEXT");
  await add("ALTER TABLE brackets ADD COLUMN data_json TEXT");
  await add("ALTER TABLE brackets ADD COLUMN payload TEXT");
  await add("ALTER TABLE brackets ADD COLUMN bracket_type TEXT");
  await add("ALTER TABLE brackets ADD COLUMN created_at TEXT");
  await add("ALTER TABLE brackets ADD COLUMN updated_at TEXT");
  await add("ALTER TABLE brackets ADD COLUMN projection_version_id INTEGER");

  // Backfill common fields for compatibility
  await add("UPDATE brackets SET user_id = COALESCE(COALESCE(user_id, userId) AS user_id, userId) WHERE user_id IS NULL OR user_id=''");
  await add("UPDATE brackets SET title = COALESCE(title, bracket_name, bracketName) WHERE title IS NULL OR title=''");
  await add("UPDATE brackets SET bracket_name = COALESCE(bracket_name, bracketName, title) WHERE bracket_name IS NULL OR bracket_name=''");
  await add("UPDATE brackets SET data_json = COALESCE(data_json, payload) WHERE data_json IS NULL OR data_json=''");
  await add("UPDATE brackets SET payload = COALESCE(payload, data_json) WHERE payload IS NULL OR payload=''");
  await add("UPDATE brackets SET created_at = COALESCE(created_at, datetime('now')) WHERE created_at IS NULL OR created_at=''");
  await add("UPDATE brackets SET updated_at = COALESCE(updated_at, created_at) WHERE updated_at IS NULL OR updated_at=''");

  // Prevent duplicate names per user (across types)
  try{
    await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS brackets_user_title_uq ON brackets(COALESCE(user_id, userId) AS user_id, title)").run();
  }catch(_e){}
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
  await ensureBracketHasProjectionColumn(env);

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
                   AND fr.user_id = brackets.user_id
                 ORDER BY fr.created_at DESC
                 LIMIT 1
              ) AS feature_status
         FROM brackets
        WHERE user_id=?
        ORDER BY COALESCE(updated_at, created_at) DESC`
    ).bind(user.id).all();

    return json({ ok:true, brackets: rs.results || [] });
  }

  if(request.method === 'POST'){
    const body = await request.json().catch(()=>null) || {};

    const desiredTitle = String(body.title || body.bracket_name || '').trim().slice(0, 80);
    const title = desiredTitle || 'My Bracket';
    const bracket_type = normalizeType(body.bracket_type);

    // Data payload may arrive as `data` (newer builds) or `payload` (older builds)
    const data = (body && Object.prototype.hasOwnProperty.call(body, 'data')) ? body.data : null;
    const payload = (body && Object.prototype.hasOwnProperty.call(body, 'payload')) ? body.payload : null;

    // Prevent duplicate bracket names for the SAME user (across all types).
    const dupe = await env.DB.prepare(
      `SELECT id FROM brackets WHERE COALESCE(COALESCE(user_id, userId) AS user_id, userId)=? AND title=? LIMIT 1`
    ).bind(user.id, title).first();
    if(dupe) return json({ ok:false, error:'NAME_TAKEN', message:'You already have a bracket with that name.' }, 409);

    const id = uid();
    const now = new Date().toISOString();

    // Prefer storing picks in data_json. Also store legacy payload for backward compatibility.
// CRITICAL: freeze a base snapshot at creation time so brackets NEVER drift when projections change.
let dataObj = (data !== null) ? data : ((payload !== null) ? payload : {});
if(!dataObj || typeof dataObj !== 'object') dataObj = {};

// If the client didn't send a base snapshot, freeze it from the currently published projection version.
let projectionVersionId = null;
if(!dataObj.base){
  const pv = await getCurrentProjectionVersion(env);
  if(pv && pv.snapshot){
    projectionVersionId = pv.id;
    const base = snapshotToBase(pv.snapshot);
    if(base) dataObj.base = base;
  }
} else {
  // If client sent base, we still try to record the current projection version id (optional).
  const pv = await getCurrentProjectionVersion(env);
  if(pv) projectionVersionId = pv.id;
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
      projectionVersionId
    ).run();

    // Best-effort record projection version id if available
    try{
      if(projectionVersionId !== null){
        await env.DB.prepare('UPDATE brackets SET projection_version_id=? WHERE id=?').bind(projectionVersionId, id).run();
      }
    }catch(_e){}

    return json({ ok:true, id });
  }

  return json({ ok:false, error:'Method not allowed' }, 405);
}