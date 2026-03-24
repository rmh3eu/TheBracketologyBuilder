import { json, requireUser, uid } from "./_util.js";

// Stability contract:
// - NEVER delete or reset bracket rows on deploy.
// - ALWAYS list all brackets for a user (no date/phase filtering).
// - Name uniqueness is per-user across ALL bracket types.

async function ensureBracketsSchema(env){
  const add = async (sql) => { try{ await env.DB.prepare(sql).run(); }catch(e){} };

  // Ensure commonly-used columns exist. These are safe no-ops if they already exist.
  await add("ALTER TABLE brackets ADD COLUMN bracket_type TEXT NOT NULL DEFAULT 'bracketology'");
  await add("ALTER TABLE brackets ADD COLUMN bracket_name TEXT");
  await add("ALTER TABLE brackets ADD COLUMN data_json TEXT");
  await add("ALTER TABLE brackets ADD COLUMN sport TEXT NOT NULL DEFAULT 'ncaa'");
  await add("ALTER TABLE brackets ADD COLUMN template_id TEXT NOT NULL DEFAULT 'ncaa_projection_full'");
  await add("ALTER TABLE brackets ADD COLUMN layout_type TEXT NOT NULL DEFAULT 'single_elim'");
  // Legacy column used by older frontends / inserts.
  await add("ALTER TABLE brackets ADD COLUMN payload TEXT");

  // Backfill legacy rows to keep them visible.
  try{
    await env.DB.prepare(
      "UPDATE brackets SET bracket_type='bracketology' WHERE bracket_type IS NULL OR bracket_type=''"
    ).run();
  }catch(e){}

  // Keep title and bracket_name aligned (we treat title as canonical display name).
  try{
    await env.DB.prepare(
      "UPDATE brackets SET title = COALESCE(title, bracket_name) WHERE title IS NULL OR title=''"
    ).run();
  }catch(e){}

  // Strong uniqueness guard: one name per user across all bracket types.
  // If older duplicates exist, index creation will fail; we still enforce in code.
  try{
    await env.DB.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS brackets_user_title_uq ON brackets(user_id, title)"
    ).run();
  }catch(e){}

  try{
    await env.DB.prepare(
      "CREATE INDEX IF NOT EXISTS brackets_user_updated_idx ON brackets(user_id, updated_at)"
    ).run();
  }catch(e){}
}


async function ensureChallengeEntriesSchema(env){
  try{
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS challenge_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      challenge TEXT NOT NULL,
      stage TEXT NOT NULL DEFAULT 'pre',
      bracket_id TEXT NOT NULL DEFAULT '',
      score INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`).run();
  }catch(e){}
}

function normalizeType(v){
  const t = String(v || '').trim().toLowerCase();
  if(t === 'official') return 'official';
  if(t === 'second_chance' || t === 'secondchance') return 'second_chance';
  return 'bracketology';
}

export async function onRequest(context){
  const { request, env } = context;
  const user = await requireUser(request, env);
  if(!user) return json({ ok:false, error:'Unauthorized' }, 401);

  await ensureBracketsSchema(env);
  await ensureChallengeEntriesSchema(env);

  if(request.method === 'GET'){
    const rs = await env.DB.prepare(
      `SELECT id, user_id, title, bracket_name, bracket_type, sport, template_id, layout_type, data_json, created_at, updated_at
         FROM brackets
        WHERE user_id=?
        ORDER BY COALESCE(updated_at, created_at) DESC`
    ).bind(user.id).all();

    const brackets = rs.results || [];

    try{
      const ce = await env.DB.prepare(
        `SELECT bracket_id,
                MAX(CASE WHEN LOWER(challenge)='best' THEN 1 ELSE 0 END) AS entered_best,
                MAX(CASE WHEN LOWER(challenge)='worst' THEN 1 ELSE 0 END) AS entered_worst
           FROM challenge_entries
          GROUP BY bracket_id`
      ).all();
      const entryMap = new Map((ce.results || []).map(row => [String(row.bracket_id || ''), row]));
      for(const b of brackets){
        const row = entryMap.get(String(b.id)) || {};
        b.entered_best = Number(row.entered_best || 0);
        b.entered_worst = Number(row.entered_worst || 0);
      }
    }catch(_e){
      for(const b of brackets){
        b.entered_best = 0;
        b.entered_worst = 0;
      }
    }

    try{
      const fr = await env.DB.prepare(
        `SELECT bracket_id,
                CASE WHEN status IS NULL OR TRIM(status)='' THEN 'pending' ELSE status END AS feature_status
           FROM feature_requests
          ORDER BY COALESCE(created_at, submitted_at, updated_at, approved_at) DESC`
      ).all();
      const fmap = new Map();
      for(const row of (fr.results || [])){
        const bid = String(row.bracket_id || '');
        if(!bid || fmap.has(bid)) continue;
        fmap.set(bid, String(row.feature_status || ''));
      }
      for(const b of brackets){
        b.feature_status = fmap.get(String(b.id)) || '';
      }
    }catch(_e){
      for(const b of brackets){
        b.feature_status = String(b.feature_status || '');
      }
    }

    return json({ ok:true, brackets });
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
      `SELECT id FROM brackets WHERE user_id=? AND title=? LIMIT 1`
    ).bind(user.id, title).first();
    if(dupe) return json({ ok:false, error:'NAME_TAKEN', message:'You already have a bracket with that name.' }, 409);

    const id = uid();
    const now = new Date().toISOString();

    // Prefer storing picks in data_json. Also store legacy payload for backward compatibility.
    const data_json = (data !== null) ? JSON.stringify(data) : ((payload !== null) ? JSON.stringify(payload) : "{}");
    const legacy_payload = (payload !== null) ? JSON.stringify(payload) : ((data !== null) ? JSON.stringify(data) : "{}");

    await env.DB.prepare(
      `INSERT INTO brackets (id, user_id, title, bracket_name, data_json, payload, bracket_type, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?)`
    ).bind(
      id,
      user.id,
      title,
      title,
      data_json,
      legacy_payload,
      bracket_type,
      now,
      now
    ).run();

    return json({ ok:true, id });
  }

  return json({ ok:false, error:'Method not allowed' }, 405);
}