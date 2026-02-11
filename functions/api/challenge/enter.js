import { json, requireUser, isLocked } from "../_util.js";


async function loadFlags(env){
  let official_bracket_live=false, tournament_started=false, sweet16_set=false, sweet16_started=false;
  try{
    const rs = await env.DB.prepare(
      "SELECT key, value_text FROM site_settings WHERE key IN ('official_bracket_live','tournament_started','sweet16_set','sweet16_started')"
    ).all();
    const map = Object.fromEntries((rs?.results||[]).map(r=>[r.key, r.value_text]));
    official_bracket_live = (map.official_bracket_live==='true');
    tournament_started = (map.tournament_started==='true');
    sweet16_set = (map.sweet16_set==='true');
    sweet16_started = (map.sweet16_started==='true');
  }catch(_e){}
  return { official_bracket_live, tournament_started, sweet16_set, sweet16_started };
}

async function ensureTables(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS challenge_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    challenge TEXT NOT NULL, -- best|worst
    stage TEXT NOT NULL DEFAULT 'pre', -- pre|r16|f4
    bracket_id TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_chal_user ON challenge_entries(user_id, challenge, stage)").run();
}

export async function onRequestPost({ request, env }){
  const user = await requireUser({request, env});
  if(!user) return json({ok:false, error:"Not signed in."}, 401);

  if(await isLocked(env)) return json({ ok:false, error:'BRACKETS_LOCKED', message:'Bracket editing is locked.' }, 423);
  await ensureTables(env);

  const body = await request.json();
  const challenge = String(body.challenge||"").toLowerCase();
  const stage = String(body.stage||"pre").toLowerCase();
  const bracket_id = String(body.bracket_id||"");

  if(!['best','worst'].includes(challenge)) return json({ok:false, error:"Invalid challenge."}, 400);
  if(!['pre','r16','f4','sc'].includes(stage)) return json({ok:false, error:"Invalid stage."}, 400);

  const flags = await loadFlags(env);
  if(stage==='pre'){
    if(!flags.official_bracket_live) return json({ok:false, error:"Challenges can only be played once the official bracket comes out."}, 403);
    if(flags.tournament_started) return json({ok:false, error:"This challenge is locked once games begin."}, 403);
  }
  if(stage==='r16'){
    if(!flags.sweet16_set) return json({ok:false, error:"Second Chance unlocks once the Sweet 16 is set."}, 403);
    if(flags.sweet16_started) return json({ok:false, error:"Second Chance is locked once Sweet 16 games begin."}, 403);
  }
  if(!bracket_id) return json({ok:false, error:"Missing bracket_id."}, 400);

  // Ensure bracket exists and belongs to user
  const br = await env.DB.prepare("SELECT id,user_id,is_public FROM brackets WHERE id=?").bind(bracket_id).first();
  if(!br) return json({ok:false, error:"Bracket not found."}, 404);
  if(br.user_id !== user.id) return json({ok:false, error:"Not authorized."}, 403);

  // Mark bracket public so it can be viewed via share links in leaderboards
  if(!br.is_public){
    await env.DB.prepare("UPDATE brackets SET is_public=1, updated_at=? WHERE id=?").bind(new Date().toISOString(), bracket_id).run();
  }

  const now = new Date().toISOString();
  const existing = await env.DB.prepare("SELECT id FROM challenge_entries WHERE user_id=? AND challenge=? AND stage=?").bind(user.id, challenge, stage).first();
  if(existing){
    await env.DB.prepare("UPDATE challenge_entries SET bracket_id=?, updated_at=? WHERE id=?").bind(bracket_id, now, existing.id).run();
    return json({ok:true, updated:true});
  }

  await env.DB.prepare("INSERT INTO challenge_entries (user_id, challenge, stage, bracket_id, created_at, updated_at) VALUES (?,?,?,?,?,?)")
    .bind(user.id, challenge, stage, bracket_id, now, now).run();

  return json({ok:true, created:true});
}
