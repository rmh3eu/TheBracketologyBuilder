import { json, requireUser, isLocked } from "./_util.js";

async function ensureBracketsHardening(env){
  const add = async (sql) => { try{ await env.DB.prepare(sql).run(); }catch(e){} };
  await add("ALTER TABLE brackets ADD COLUMN bracket_type TEXT NOT NULL DEFAULT 'bracketology'");
  await add("ALTER TABLE brackets ADD COLUMN bracket_name TEXT");
  await add("ALTER TABLE brackets ADD COLUMN data_json TEXT");
  await add("ALTER TABLE brackets ADD COLUMN sport TEXT");
  await add("ALTER TABLE brackets ADD COLUMN template_id TEXT");
  await add("ALTER TABLE brackets ADD COLUMN layout_type TEXT");
  try{ await env.DB.prepare("UPDATE brackets SET bracket_type='bracketology' WHERE bracket_type IS NULL OR bracket_type=''").run(); }catch(e){}
  try{ await env.DB.prepare("UPDATE brackets SET title = COALESCE(title, bracket_name) WHERE title IS NULL OR title='' ").run(); }catch(e){}
  try{ await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS brackets_user_title_uq ON brackets(user_id, title)").run(); }catch(e){}
}
function inferSport(row){
  if(row && row.sport) return String(row.sport).toLowerCase();
  try{ const d = JSON.parse(row.data_json || '{}'); return String(d && d.sport || '').toLowerCase(); }catch(e){ return ''; }
}
export async function onRequestGet({ request, env }){
  await ensureBracketsHardening(env);
  const url = new URL(request.url); const id = url.searchParams.get("id");
  if(!id) return json({ ok:false, error:"Missing id." }, 400);
  const user = await requireUser({ request, env });
  const row = await env.DB.prepare("SELECT id,user_id,title,bracket_name,data_json,is_public,created_at,updated_at,bracket_type,sport,template_id,layout_type FROM brackets WHERE id=?").bind(id).first();
  if(!row) return json({ ok:false, error:"Not found." }, 404);
  if(!row.is_public && (!user || user.id !== row.user_id)) return json({ ok:false, error:"Not authorized." }, 403);
  return json({ ok:true, bracket: { id: row.id, bracket_name: row.bracket_name || row.title || "My Bracket", title: row.title || row.bracket_name || "My Bracket", user_id: row.user_id, data: JSON.parse(row.data_json || "{}"), created_at: row.created_at, updated_at: row.updated_at, bracket_type: row.bracket_type || "bracketology", sport: inferSport(row), template_id: row.template_id || '', layout_type: row.layout_type || '' }});
}
export async function onRequestPut({ request, env }){
  await ensureBracketsHardening(env);
  const user = await requireUser({ request, env });
  if(!user) return json({ ok:false, error:"Not logged in." }, 401);
  if(await isLocked(env)) return json({ ok:false, error:"BRACKETS_LOCKED", message:"Bracket editing is locked." }, 423);
  const url = new URL(request.url); const body = await request.json();
  const id = String(body.id || url.searchParams.get('id') || "");
  const desired_name = String(body.bracket_name || body.title || "").trim().slice(0, 80);
  const bracket_name = desired_name || "My Bracket"; const title = bracket_name;
  const data = Object.prototype.hasOwnProperty.call(body, 'data') ? body.data : null;
  const sport = String(body.sport || '').trim().toLowerCase() || null;
  const template_id = String(body.template_id || '').trim() || null;
  const layout_type = String(body.layout_type || '').trim() || null;
  if(!id) return json({ ok:false, error:"Missing id." }, 400);
  const existing = await env.DB.prepare("SELECT id,user_id,bracket_type,data_json FROM brackets WHERE id=?").bind(id).first();
  if(!existing) return json({ ok:false, error:"Not found." }, 404);
  if(existing.user_id !== user.id) return json({ ok:false, error:"Not authorized." }, 403);
  const dup = await env.DB.prepare("SELECT id FROM brackets WHERE user_id=? AND id<>? AND title=? LIMIT 1").bind(user.id, id, bracket_name).first();
  if(dup) return json({ ok:false, error:"NAME_TAKEN", message:"You already have a bracket with that name." }, 409);
  const now = new Date().toISOString();
  let incomingData = data;
  if(data !== null){
    let existingData = {}; try{ existingData = JSON.parse(existing.data_json || "{}"); }catch(e){ existingData = {}; }
    const existingBase = (existingData && existingData.base) ? existingData.base : null;
    if(existingBase){ if(!incomingData || typeof incomingData !== 'object') incomingData = {}; incomingData.base = existingBase; }
  }
  const nextDataJson = (data === null) ? (existing.data_json || "{}") : JSON.stringify(incomingData);
  await env.DB.prepare("UPDATE brackets SET title=?, bracket_name=?, data_json=?, sport=COALESCE(?, sport), template_id=COALESCE(?, template_id), layout_type=COALESCE(?, layout_type), updated_at=? WHERE id=?").bind(title, bracket_name, nextDataJson, sport, template_id, layout_type, now, id).run();
  return json({ ok:true });
}
export async function onRequestDelete({ request, env }){
  const user = await requireUser({ request, env });
  if(!user) return json({ ok:false, error:"Not logged in." }, 401);
  if(await isLocked(env)) return json({ ok:false, error:"BRACKETS_LOCKED", message:"Bracket editing is locked." }, 423);
  const url = new URL(request.url); const id = url.searchParams.get("id");
  if(!id) return json({ ok:false, error:"Missing id." }, 400);
  const row = await env.DB.prepare("SELECT id,user_id FROM brackets WHERE id=?").bind(id).first();
  if(!row) return json({ ok:false, error:"Not found." }, 404);
  if(row.user_id !== user.id) return json({ ok:false, error:"Not authorized." }, 403);
  await env.DB.prepare("DELETE FROM brackets WHERE id=?").bind(id).run();
  return json({ ok:true });
}
