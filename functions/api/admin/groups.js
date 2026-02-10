import { json, requireUser, isAdmin, sendResendEmail, getSiteDomain } from "../_util.js";

async function ensureTables(env){
  // relies on groups tables created by /api/groups ensureTables, but keep safe
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    challenge TEXT NOT NULL,
    name TEXT NOT NULL,
    is_public INTEGER NOT NULL DEFAULT 0,
    join_password_hash TEXT,
    created_by INTEGER,
    created_at TEXT NOT NULL,
    max_members INTEGER NOT NULL DEFAULT 6,
    tier_price INTEGER NOT NULL DEFAULT 0,
    upgraded_at TEXT
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS group_members (
    group_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at TEXT NOT NULL,
    PRIMARY KEY (group_id, user_id)
  )`).run();
  try{ await env.DB.prepare("ALTER TABLE groups ADD COLUMN max_members INTEGER NOT NULL DEFAULT 6").run(); }catch(e){}
  try{ await env.DB.prepare("ALTER TABLE groups ADD COLUMN tier_price INTEGER NOT NULL DEFAULT 0").run(); }catch(e){}
  try{ await env.DB.prepare("ALTER TABLE groups ADD COLUMN upgraded_at TEXT").run(); }catch(e){}
}

export async function onRequestGet({request, env}){
  await ensureTables(env);
  const user = await requireUser({request, env});
  if(!isAdmin(user, env)) return json({ok:false, error:"Forbidden"}, 403);

  const q = `
    SELECT g.id, g.challenge, g.name, g.created_by, g.created_at, g.max_members, g.tier_price, g.upgraded_at,
      (SELECT COUNT(1) FROM group_members gm WHERE gm.group_id=g.id) AS member_count
    FROM groups g
    WHERE g.is_public=0 AND g.tier_price>0 AND g.max_members>6 AND g.upgraded_at IS NULL
    ORDER BY g.created_at DESC
  `;
  const rs = await env.DB.prepare(q).all();
  return json({ok:true, pending: rs.results||[]});
}

export async function onRequestPost({request, env}){
  await ensureTables(env);
  const user = await requireUser({request, env});
  if(!isAdmin(user, env)) return json({ok:false, error:"Forbidden"}, 403);

  const body = await request.json().catch(()=>({}));
  const action = String(body.action||"").toLowerCase();
  if(action!=="confirm") return json({ok:false, error:"Bad action"}, 400);

  const group_id = String(body.group_id||"");
  if(!group_id) return json({ok:false, error:"Missing group_id"}, 400);

  const g = await env.DB.prepare("SELECT * FROM groups WHERE id=?").bind(group_id).first();
  if(!g) return json({ok:false, error:"Not found"}, 404);
  if(Number(g.is_public)===1) return json({ok:false, error:"Public group"}, 400);

  const now = new Date().toISOString();
  await env.DB.prepare("UPDATE groups SET upgraded_at=? WHERE id=?").bind(now, group_id).run();

  // optional: notify creator
  try{
    const u = await env.DB.prepare("SELECT email FROM users WHERE id=?").bind(g.created_by).first();
    if(u && u.email){
      const domain = getSiteDomain(env);
      const subj = `Your group upgrade is confirmed (${domain})`;
      const html = `<div style="font-family:Arial,sans-serif;font-size:14px;">
        <p>✅ Your private group <b>${g.name}</b> is now unlocked up to <b>${g.max_members}</b> members.</p>
        <p>You can share the group invite link again and friends can join immediately.</p>
      </div>`;
      await sendResendEmail(env, u.email, subj, html, `Your group upgrade is confirmed. Group: ${g.name}`);
    }
  }catch(e){}

  return json({ok:true, upgraded_at: now});
}
