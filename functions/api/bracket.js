import { json, requireUser, isLocked } from "./_util.js";

// Keep schema + indexes safe and consistent across builds.
async function ensureBracketsHardening(env){
  const add = async (sql) => { try{ await env.DB.prepare(sql).run(); }catch(e){} };
  await add("ALTER TABLE brackets ADD COLUMN bracket_type TEXT NOT NULL DEFAULT 'bracketology'");
  await add("ALTER TABLE brackets ADD COLUMN bracket_name TEXT");
  await add("ALTER TABLE brackets ADD COLUMN data_json TEXT");

  // Backfill to keep legacy rows visible.
  try{
    await env.DB.prepare("UPDATE brackets SET bracket_type='bracketology' WHERE bracket_type IS NULL OR bracket_type=''").run();
  }catch(e){}
  try{
    await env.DB.prepare("UPDATE brackets SET title = COALESCE(title, bracket_name) WHERE title IS NULL OR title='' ").run();
  }catch(e){}

  // Strong uniqueness per user across all bracket types.
  try{
    await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS brackets_user_title_uq ON brackets(user_id, title)").run();
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
    "SELECT id,user_id,bracket_type,data_json FROM brackets WHERE id=?"
  ).bind(id).first();

  if(!existing) return json({ ok:false, error:"Not found." }, 404);
  if(existing.user_id !== user.id) return json({ ok:false, error:"Not authorized." }, 403);

  // Unique per user across ALL bracket types (exclude this id)
  const dup = await env.DB.prepare(
    "SELECT id FROM brackets WHERE user_id=? AND id<>? AND title=? LIMIT 1"
  ).bind(user.id, id, bracket_name).first();
  if(dup) return json({ ok:false, error:"NAME_TAKEN", message:"You already have a bracket with that name." }, 409);

  const now = new Date().toISOString();

  // If data was not provided, treat this as a rename-only update.
  const nextDataJson = (data === null) ? (existing.data_json || "{}") : JSON.stringify(data);
  await env.DB.prepare(
    "UPDATE brackets SET title=?, bracket_name=?, data_json=?, updated_at=? WHERE id=?"
  ).bind(title, bracket_name, nextDataJson, now, id).run();

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
