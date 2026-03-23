
import { json, requireUser, isLocked } from "../_util.js";

async function loadFlags(env){
  let sweet16_set=false, sweet16_started=false;
  try{
    const rs = await env.DB.prepare(
      "SELECT key, value_text FROM site_settings WHERE key IN ('sweet16_set','sweet16_started')"
    ).all();
    const map = Object.fromEntries((rs?.results||[]).map(r=>[r.key, r.value_text]));
    sweet16_set = (map.sweet16_set==='true');
    sweet16_started = (map.sweet16_started==='true');
  }catch(_e){}
  return { sweet16_set, sweet16_started };
}

async function ensureTables(env){
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
  try{ await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_chal_user ON challenge_entries(user_id, challenge, stage)").run(); }catch(_e){}
}

export async function onRequestPost({ request, env }){
  const user = await requireUser({request, env});
  if(!user) return json({ok:false, error:"Not signed in."}, 401);
  if(await isLocked(env)) return json({ ok:false, error:'BRACKETS_LOCKED', message:'Bracket editing is locked.' }, 423);

  await ensureTables(env);
  const body = await request.json();
  const challenge = String(body.challenge||"").toLowerCase();
  const bracket_id = String(body.bracket_id||"");
  if(!['best','worst'].includes(challenge)) return json({ok:false, error:"Invalid challenge."}, 400);
  if(!bracket_id) return json({ok:false, error:"Missing bracket_id."}, 400);

  const flags = await loadFlags(env);
  if(!flags.sweet16_set) return json({ok:false, error:"Second Chance unlocks once the Sweet 16 is set."}, 403);
  if(flags.sweet16_started) return json({ok:false, error:"Second Chance is locked once Sweet 16 games begin."}, 403);

  const br = await env.DB.prepare("SELECT id,user_id,is_public,bracket_type FROM brackets WHERE id=?").bind(bracket_id).first();
  if(!br) return json({ok:false, error:"Bracket not found."}, 404);
  if(Number(br.user_id) !== Number(user.id)) return json({ok:false, error:"Not authorized."}, 403);
  if(String(br.bracket_type||'').toLowerCase() !== 'second_chance'){
    return json({ok:false, error:"Only Second Chance brackets can enter this challenge."}, 403);
  }

  if(!br.is_public){
    try{
      await env.DB.prepare("UPDATE brackets SET is_public=1, updated_at=? WHERE id=?").bind(new Date().toISOString(), bracket_id).run();
    }catch(_e){
      try{ await env.DB.prepare("UPDATE brackets SET is_public=1 WHERE id=?").bind(bracket_id).run(); }catch(_e2){}
    }
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO challenge_entries (user_id, challenge, stage, bracket_id, score, created_at, updated_at) VALUES (?,?,?,?,?,?,?)"
  ).bind(user.id, challenge, 'sc', bracket_id, 0, now, now).run();

  return json({ok:true, created:true});
}
