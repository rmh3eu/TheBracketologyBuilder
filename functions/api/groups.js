
import { json, requireUser, randomB64, isAdmin, sendResendEmail, getSiteDomain } from "./_util.js";

async function ensureTables(env){
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
  // lightweight migrations (safe to run every request)
  try{ await env.DB.prepare("ALTER TABLE groups ADD COLUMN max_members INTEGER NOT NULL DEFAULT 6").run(); }catch(e){}
  try{ await env.DB.prepare("ALTER TABLE groups ADD COLUMN tier_price INTEGER NOT NULL DEFAULT 0").run(); }catch(e){}
  try{ await env.DB.prepare("ALTER TABLE groups ADD COLUMN upgraded_at TEXT").run(); }catch(e){}
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS group_members (
    group_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at TEXT NOT NULL,
    PRIMARY KEY (group_id, user_id)
  )`).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_groups_challenge_public ON groups(challenge, is_public)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id)").run();
}

// simple sha-256 hex
async function sha256Hex(str){
  const enc = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
}


function isBadGroupName(name){
  const n = String(name||"").toLowerCase();
  // Minimal safety filter: block slurs/hate speech and explicit sexual content. Childish humor is OK.
  const banned = [
    "nigger","faggot","kike","spic","chink","wetback","raghead","tranny",
    "hitler","nazi","kkk",
    "rape","rapist",
  ];
  return banned.some(w=>n.includes(w));
}

function tierForMax(maxMembers){
  const n0 = Number(maxMembers||0);
  if(!Number.isFinite(n0) || n0<=0) return null;
  // All private groups are FREE. No payment tiers.
  // Keep a reasonable cap for stability; can be raised later.
  const n = Math.max(2, Math.min(100, Math.floor(n0)));
  return {max:n, price:0};
}

async function seedPublicGroups(env){
  // idempotent
  const now = new Date().toISOString();
    const presets = [
    ["worst","🥴 This Guy Does Not Know Ball"],
    ["worst","🗑️ Busted Brackets"],
    ["worst","😭 March Sadness"],
    ["worst","🏆 The Last Place Chase"],
    ["best","🧠 This Guy Knows Ball"],
    ["best","😎 Bracket Boys"],
    ["best","🏀 Certified Ball Knowers"],
    ["best","🤓 Professional Bracketiers"],
  ];
  for(const [challenge,name] of presets){
    const id = `${challenge}__public__${name.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"")}`;
    await env.DB.prepare(`INSERT INTO groups (id, challenge, name, is_public, created_by, created_at)
      VALUES (?,?,?,?,?,?)
      ON CONFLICT(id) DO NOTHING
    `).bind(id, challenge, name, 1, null, now).run();
  }
}

export async function onRequestGet({ request, env }){
  await ensureTables(env);
  await seedPublicGroups(env);

  const url = new URL(request.url);
  const challenge = (url.searchParams.get("challenge")||"").toLowerCase();
  if(challenge && !["best","worst"].includes(challenge)) return json({ok:false, error:"Bad challenge."}, 400);

  // user optional: if logged in, return my groups membership
  let user = null;
  try{ user = await requireUser({request, env}); }catch(e){ user = null; }

  // Include member_count for nicer leaderboard/group UI
  let q = `SELECT g.id, g.challenge, g.name, g.is_public, g.created_by, g.max_members, g.tier_price,
    (SELECT COUNT(1) FROM group_members gm WHERE gm.group_id = g.id) AS member_count
    FROM groups g`;
  const binds=[];
  if(challenge){ q += " WHERE g.challenge=?"; binds.push(challenge); }
  q += " ORDER BY g.is_public DESC, g.name ASC";
  const rs = await env.DB.prepare(q).bind(...binds).all();
  const groups = rs.results||[];

  let myGroupIds = [];
  if(user){
    const ms = await env.DB.prepare("SELECT group_id FROM group_members WHERE user_id=?").bind(user.id).all();
    myGroupIds = (ms.results||[]).map(r=>r.group_id);
  }

  return json({ok:true, groups, my_groups: myGroupIds});
}

export async function onRequestPost({ request, env }){
  const user = await requireUser({request, env});
  await ensureTables(env);
  await seedPublicGroups(env);

  const body = await request.json();
  const action = String(body.action||"").toLowerCase();

  if(action==="create"){
    const challenge = String(body.challenge||"").toLowerCase();
    const name = String(body.name||"").trim();
    const password = String(body.password||"");
    const isPublic = !!body.is_public;

    if(!["best","worst"].includes(challenge)) return json({ok:false, error:"Pick best or worst."}, 400);
    if(!name || name.length<3 || name.length>40) return json({ok:false, error:"Group name must be 3-40 chars."}, 400);
    if(isBadGroupName(name)) return json({ok:false, error:"That group name isn’t allowed."}, 400);
    if(isPublic) return json({ok:false, error:"Public groups are pre-made."}, 400);
    if(!password || password.length<4) return json({ok:false, error:"Password must be at least 4 characters."}, 400);

    const id = `${challenge}__priv__${randomB64(9)}`;
    const hash = await sha256Hex(password);
    const now = new Date().toISOString();
    await env.DB.prepare(`INSERT INTO groups (id, challenge, name, is_public, join_password_hash, created_by, created_at, max_members, tier_price)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).bind(id, challenge, name, 0, hash, user.id, now, (tierForMax(body.max_members||10)||{max:10,price:0}).max, 0).run();

    // auto-join creator
    await env.DB.prepare("INSERT OR IGNORE INTO group_members (group_id, user_id, joined_at) VALUES (?,?,?)")
      .bind(id, user.id, now).run();

    return json({ok:true, group:{id, challenge, name, is_public:0}, join_link:`/?group=${encodeURIComponent(id)}#${challenge}`});
  }

  if(action==="join"){
    const group_id = String(body.group_id||"");
    const password = String(body.password||"");
    if(!group_id) return json({ok:false, error:"Missing group."}, 400);

    const grs = await env.DB.prepare("SELECT * FROM groups WHERE id=?").bind(group_id).first();
    if(!grs) return json({ok:false, error:"Group not found."}, 404);

    if(Number(grs.is_public)===0){
      const hash = await sha256Hex(password);
      if(!password || hash !== grs.join_password_hash) return json({ok:false, error:"Wrong password."}, 403);
    }

    
    // enforce private group size cap (free by default: 6). If a paid upgrade is selected, hard-block joins
    // above 6 until payment is confirmed (upgraded_at set).
    let effectiveMax = 9999;
    if(Number(grs.is_public)===0){
      const requestedMax = Number(grs.max_members||6);
      const price = Number(grs.tier_price||0);
      const confirmed = !!(grs.upgraded_at);
      effectiveMax = (price>0 && !confirmed) ? 6 : requestedMax;
      const c = await env.DB.prepare("SELECT COUNT(1) as c FROM group_members WHERE group_id=?").bind(group_id).first();
      const count = Number(c && c.c || 0);
      if(count >= effectiveMax){
        const pendingMsg = (price>0 && !confirmed)
          ? "This private group is currently capped at 6 members until the organizer’s upgrade payment is confirmed."
          : `This private group is full (max ${effectiveMax}).`;
        return json({ok:false, error: pendingMsg, needs_payment: (price>0 && !confirmed), effective_max: effectiveMax}, 409);
      }
    }
const now = new Date().toISOString();
    await env.DB.prepare("INSERT OR IGNORE INTO group_members (group_id, user_id, joined_at) VALUES (?,?,?)")
      .bind(group_id, user.id, now).run();
    return json({ok:true});
  }

  
  if(action==="set_max"){
    const group_id = String(body.group_id||"");
    const desired = Number(body.max_members||0);
    if(!group_id) return json({ok:false, error:"Missing group."}, 400);

    const g = await env.DB.prepare("SELECT * FROM groups WHERE id=?").bind(group_id).first();
    if(!g) return json({ok:false, error:"Group not found."}, 404);
    if(Number(g.is_public)===1) return json({ok:false, error:"Public groups can’t change size."}, 400);
    if(Number(g.created_by)!==Number(user.id)) return json({ok:false, error:"Only the group creator can change settings."}, 403);

    const tier = tierForMax(desired);
    if(!tier) return json({ok:false, error:"Bad size."}, 400);

    // enforce non-decreasing max
    const currentMax = Number(g.max_members||6);
    if(tier.max < currentMax) return json({ok:false, error:"You can’t lower the max members yet."}, 400);

    const now = new Date().toISOString();
    await env.DB.prepare("UPDATE groups SET max_members=?, tier_price=?, upgraded_at=? WHERE id=?")
      .bind(tier.max, 0, (0===0 ? now : null), group_id).run();

    // Free groups: no checkout/payment
    const checkout_url = null;
    return json({ok:true, max_members: tier.max, tier_price: 0, checkout_url});
  }

if(action==="leave"){
    const group_id = String(body.group_id||"");
    if(!group_id) return json({ok:false, error:"Missing group."}, 400);
    await env.DB.prepare("DELETE FROM group_members WHERE group_id=? AND user_id=?").bind(group_id, user.id).run();
    return json({ok:true});
  }

  return json({ok:false, error:"Bad action."}, 400);
}
