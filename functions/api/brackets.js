import { json, requireUser, uid } from "./_util.js";

// Current projection snapshot (used ONLY to freeze base for NEW brackets at creation time).
const CURRENT_SNAPSHOT = {
  "EAST": [
    [
      1,
      "Duke"
    ],
    [
      2,
      "Purdue"
    ],
    [
      3,
      "Nebraska"
    ],
    [
      4,
      "Michigan St"
    ],
    [
      5,
      "St Johns"
    ],
    [
      6,
      "Louisville"
    ],
    [
      7,
      "Kentucky"
    ],
    [
      8,
      "NC State"
    ],
    [
      9,
      "Texas A&M"
    ],
    [
      10,
      "Clemson"
    ],
    [
      11,
      "Santa Clara"
    ],
    [
      12,
      "High Point"
    ],
    [
      13,
      "Liberty"
    ],
    [
      14,
      "Navy"
    ],
    [
      15,
      "Merrimack"
    ],
    [
      16,
      "LIU"
    ]
  ],
  "WEST": [
    [
      1,
      "Arizona"
    ],
    [
      2,
      "Houston"
    ],
    [
      3,
      "Virginia"
    ],
    [
      4,
      "Kansas"
    ],
    [
      5,
      "North Carolina"
    ],
    [
      6,
      "Wisconsin"
    ],
    [
      7,
      "Villanova"
    ],
    [
      8,
      "Utah State"
    ],
    [
      9,
      "Iowa"
    ],
    [
      10,
      "UCLA"
    ],
    [
      11,
      "New Mexico"
    ],
    [
      12,
      "Belmont"
    ],
    [
      13,
      "Utah Valley"
    ],
    [
      14,
      "ETSU"
    ],
    [
      15,
      "Wright State"
    ],
    [
      16,
      "App St"
    ]
  ],
  "MIDWEST": [
    [
      1,
      "Michigan"
    ],
    [
      2,
      "Florida"
    ],
    [
      3,
      "Illinois"
    ],
    [
      4,
      "Alabama"
    ],
    [
      5,
      "Arkansas"
    ],
    [
      6,
      "Vanderbilt"
    ],
    [
      7,
      "Saint Louis"
    ],
    [
      8,
      "Miami FLA"
    ],
    [
      9,
      "UCF"
    ],
    [
      10,
      "Georgia"
    ],
    [
      11,
      "Texas"
    ],
    [
      12,
      "Yale"
    ],
    [
      13,
      "SF Austin"
    ],
    [
      14,
      "N Dakota St"
    ],
    [
      15,
      "Austin Peay"
    ],
    [
      16,
      "Howard"
    ]
  ],
  "SOUTH": [
    [
      1,
      "Iowa State"
    ],
    [
      2,
      "UConn"
    ],
    [
      3,
      "Gonzaga"
    ],
    [
      4,
      "Texas Tech"
    ],
    [
      5,
      "BYU"
    ],
    [
      6,
      "Tennessee"
    ],
    [
      7,
      "Miami Ohio"
    ],
    [
      8,
      "SMU"
    ],
    [
      9,
      "Saint Marys"
    ],
    [
      10,
      "Auburn"
    ],
    [
      11,
      "Missouri"
    ],
    [
      12,
      "USF"
    ],
    [
      13,
      "UNCW"
    ],
    [
      14,
      "UC Irvine"
    ],
    [
      15,
      "Portland State"
    ],
    [
      16,
      "UMBC"
    ]
  ]
};


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

  if(request.method === 'GET'){
    // Return ALL brackets for this user (no phase filtering, no date filtering).
    const rs = await env.DB.prepare(
      `SELECT id,
              user_id,
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
      `SELECT id FROM brackets WHERE user_id=? AND title=? LIMIT 1`
    ).bind(user.id, title).first();
    if(dupe) return json({ ok:false, error:'NAME_TAKEN', message:'You already have a bracket with that name.' }, 409);

    const id = uid();
    const now = new Date().toISOString();

    // Prefer storing picks in data_json. Also store legacy payload for backward compatibility.
// CRITICAL: freeze a base snapshot at creation time so brackets NEVER drift when projections change.
let dataObj = (data !== null) ? data : ((payload !== null) ? payload : {});
if(!dataObj || typeof dataObj !== 'object') dataObj = {};
if(!dataObj.base) dataObj.base = CURRENT_SNAPSHOT;

const data_json = JSON.stringify(dataObj);
const legacy_payload = JSON.stringify(dataObj);

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
