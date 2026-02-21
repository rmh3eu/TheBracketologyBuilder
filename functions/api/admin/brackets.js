import { json, requireUser, isAdmin } from "../_util.js";

async function ensureBracketsSchema(env){
  const add = async (sql) => { try{ await env.DB.prepare(sql).run(); }catch(_e){} };
  await add("ALTER TABLE brackets ADD COLUMN bracket_type TEXT NOT NULL DEFAULT 'bracketology'");
  await add("ALTER TABLE brackets ADD COLUMN bracket_name TEXT");
  await add("ALTER TABLE brackets ADD COLUMN data_json TEXT");
  await add("ALTER TABLE brackets ADD COLUMN payload TEXT");
  try{ await env.DB.prepare("CREATE INDEX IF NOT EXISTS brackets_updated_idx ON brackets(updated_at)").run(); }catch(_e){}
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
