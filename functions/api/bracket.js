import { json, requireUser, isLocked } from "./_util.js";

// Keep schema + indexes safe and consistent across builds.
async function ensureBracketsHardening(env){
  // Ensure brackets table exists, then add missing columns best-effort.
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
      is_public INTEGER DEFAULT 0
    )
  `).run();

  const add = async (sql) => { try{ await env.DB.prepare(sql).run(); }catch(e){} };
  await add("ALTER TABLE brackets ADD COLUMN bracket_type TEXT");
  await add("ALTER TABLE brackets ADD COLUMN bracket_name TEXT");
  await add("ALTER TABLE brackets ADD COLUMN bracketName TEXT");
  await add("ALTER TABLE brackets ADD COLUMN title TEXT");
  await add("ALTER TABLE brackets ADD COLUMN data_json TEXT");
  await add("ALTER TABLE brackets ADD COLUMN payload TEXT");
  await add("ALTER TABLE brackets ADD COLUMN user_id TEXT");
  await add("ALTER TABLE brackets ADD COLUMN userId TEXT");
  await add("ALTER TABLE brackets ADD COLUMN created_at TEXT");
  await add("ALTER TABLE brackets ADD COLUMN updated_at TEXT");
  await add("ALTER TABLE brackets ADD COLUMN is_public INTEGER DEFAULT 0");

  // Backfill to keep legacy rows visible.
  try{ await env.DB.prepare("UPDATE brackets SET user_id = COALESCE(user_id, userId) WHERE user_id IS NULL OR user_id=''").run(); }catch(e){}
  try{ await env.DB.prepare("UPDATE brackets SET title = COALESCE(title, bracket_name, bracketName) WHERE title IS NULL OR title='' ").run(); }catch(e){}
  try{ await env.DB.prepare("UPDATE brackets SET bracket_name = COALESCE(bracket_name, bracketName, title) WHERE bracket_name IS NULL OR bracket_name='' ").run(); }catch(e){}
  try{ await env.DB.prepare("UPDATE brackets SET data_json = COALESCE(data_json, payload) WHERE data_json IS NULL OR data_json='' ").run(); }catch(e){}
  try{ await env.DB.prepare("UPDATE brackets SET created_at = COALESCE(created_at, datetime('now')) WHERE created_at IS NULL OR created_at='' ").run(); }catch(e){}
  try{ await env.DB.prepare("UPDATE brackets SET updated_at = COALESCE(updated_at, created_at) WHERE updated_at IS NULL OR updated_at='' ").run(); }catch(e){}

  // Strong uniqueness per user across all bracket types.
  try{
    await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS brackets_user_title_uq ON brackets(COALESCE(user_id,userId), title)").run();
  }catch(e){}
}

// Backwards compatible no-op wrappers (some older code may still call these names)
async function ensureBracketType(env){ return await ensureBracketsHardening(env); }
async function ensureBracketName(env){ return await ensureBracketsHardening(env); }

export async function onRequestGet({ request, env }){
  await ensureBracketsHardening(env);

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if(!id) return json({ ok:false, error:"Missing id." }, 400);

  const user = await requireUser({ request, env });

  const row = await env.DB.prepare(
    "SELECT id,user_id,title,bracket_name,data_json,is_public,created_at,updated_at,bracket_type FROM brackets WHERE id=?"
  ).bind(id).first();

  if(!row) return json({ ok:false, error:"Not found." }, 404);
  if(!row.is_public && (!user || user.id !== row.user_id)) return json({ ok:false, error:"Not authorized." }, 403);

  return json({ ok:true, bracket: {
    id: row.id,
    bracket_name: row.bracket_name || row.title || "My Bracket",
    title: row.title || row.bracket_name || "My Bracket",
    user_id: row.user_id,
    data: JSON.parse(row.data_json || "{}"),
    created_at: row.created_at,
    updated_at: row.updated_at,
    bracket_type: row.bracket_type || "bracketology"
  }});
}

export async function onRequestPut({ request, env }){
  await ensureBracketsHardening(env);

  const user = await requireUser({ request, env });
  if(!user) return json({ ok:false, error:"Not logged in." }, 401);

  if(await isLocked(env)){
    return json({ ok:false, error:"BRACKETS_LOCKED", message:"Bracket editing is locked." }, 423);
  }

  const url = new URL(request.url);
  const body = await request.json();
  // Support both body.id and query param id (some callers use /api/bracket?id=...)
  const id = String(body.id || url.searchParams.get('id') || "");
  const desired_name = String(body.bracket_name || body.title || "").trim().slice(0, 80);
  const bracket_name = desired_name || "My Bracket";
  const title = bracket_name;
  // Data is optional for rename-only operations.
  const data = (body && Object.prototype.hasOwnProperty.call(body, 'data')) ? body.data : null;

  if(!id) return json({ ok:false, error:"Missing id." }, 400);

  const existing = await env.DB.prepare(
    "SELECT id, COALESCE(user_id,userId) AS user_id, bracket_type, data_json, payload FROM brackets WHERE id=?"
  ).bind(id).first();

  if(!existing) return json({ ok:false, error:"Not found." }, 404);
  if(existing.user_id !== user.id) return json({ ok:false, error:"Not authorized." }, 403);

  // Unique per user across ALL bracket types (exclude this id)
  const dup = await env.DB.prepare(
    "SELECT id FROM brackets WHERE user_id=? AND id<>? AND title=? LIMIT 1"
  ).bind(user.id, id, bracket_name).first();
  if(dup) return json({ ok:false, error:"NAME_TAKEN", message:"You already have a bracket with that name." }, 409);

  const now = new Date().toISOString();

  // Preserve frozen Round of 64 snapshot (base) ALWAYS.
  // Non‑negotiable rule: once a bracket has a base snapshot, it must NEVER change,
  // even if the client sends a different base after projections update.
  let existingData = {};
  try{ existingData = JSON.parse(existing.data_json || existing.payload || '{}'); }catch(e){ existingData = {}; }

  // If data was not provided, treat this as a rename-only update.
  let mergedData = data;
  if(mergedData && typeof mergedData === "object"){
    if(existingData && existingData.base){
      // Force immutability: always keep the stored base.
      mergedData.base = existingData.base;
    }else if(!mergedData.base && existingData && existingData.base){
      mergedData.base = existingData.base;
    }
  }
  const nextDataJson = (mergedData === null) ? (existing.data_json || "{}") : JSON.stringify(mergedData);
  await env.DB.prepare(
    "UPDATE brackets SET title=?, bracket_name=?, data_json=?, payload=?, updated_at=? WHERE id=?"
  ).bind(title, bracket_name, nextDataJson, nextDataJson, now, id).run();

  return json({ ok:true });
}

export async function onRequestDelete({ request, env }){
  const user = await requireUser({ request, env });
  if(!user) return json({ ok:false, error:"Not logged in." }, 401);

  if(await isLocked(env)){
    return json({ ok:false, error:"BRACKETS_LOCKED", message:"Bracket editing is locked." }, 423);
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if(!id) return json({ ok:false, error:"Missing id." }, 400);

  const row = await env.DB.prepare("SELECT id,user_id FROM brackets WHERE id=?").bind(id).first();
  if(!row) return json({ ok:false, error:"Not found." }, 404);
  if(row.user_id !== user.id) return json({ ok:false, error:"Not authorized." }, 403);

  await env.DB.prepare("DELETE FROM brackets WHERE id=?").bind(id).run();
  return json({ ok:true });
}
