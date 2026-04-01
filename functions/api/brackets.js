import { json, requireUser, uid } from "./_util.js";

async function ensureBracketsSchema(env){
  const add = async (sql) => { try{ await env.DB.prepare(sql).run(); }catch(e){} };
  await add("ALTER TABLE brackets ADD COLUMN bracket_type TEXT NOT NULL DEFAULT 'bracketology'");
  await add("ALTER TABLE brackets ADD COLUMN bracket_name TEXT");
  await add("ALTER TABLE brackets ADD COLUMN data_json TEXT");
  await add("ALTER TABLE brackets ADD COLUMN payload TEXT");
  await add("ALTER TABLE brackets ADD COLUMN sport TEXT");
  await add("ALTER TABLE brackets ADD COLUMN template_id TEXT");
  await add("ALTER TABLE brackets ADD COLUMN layout_type TEXT");
  try{ await env.DB.prepare("UPDATE brackets SET bracket_type='bracketology' WHERE bracket_type IS NULL OR bracket_type=''").run(); }catch(e){}
  try{ await env.DB.prepare("UPDATE brackets SET title = COALESCE(title, bracket_name) WHERE title IS NULL OR title=''").run(); }catch(e){}
  try{ await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS brackets_user_title_uq ON brackets(user_id, title)").run(); }catch(e){}
  try{ await env.DB.prepare("CREATE INDEX IF NOT EXISTS brackets_user_updated_idx ON brackets(user_id, updated_at)").run(); }catch(e){}
}
async function ensureChallengeEntriesSchema(env){
  try{ await env.DB.prepare(`CREATE TABLE IF NOT EXISTS challenge_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      challenge TEXT NOT NULL,
      stage TEXT NOT NULL DEFAULT 'pre',
      bracket_id TEXT NOT NULL DEFAULT '',
      score INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`).run(); }catch(e){}
}
async function ensureGamesSubscriptionSchema(env){
  const add = async (sql) => { try{ await env.DB.prepare(sql).run(); }catch(e){} };
  await add("ALTER TABLE users ADD COLUMN games_subscription_status TEXT");
  await add("ALTER TABLE users ADD COLUMN games_subscription_started_at TEXT");
  await add("ALTER TABLE users ADD COLUMN games_subscription_ends_at TEXT");
}
function lower(v){ return String(v||'').trim().toLowerCase(); }
function normalizeType(v){
  const t = lower(v);
  if(t === 'official') return 'official';
  if(t === 'second_chance' || t === 'secondchance') return 'second_chance';
  if(t === 'nba') return 'nba';
  return 'bracketology';
}
function inferSport(row){
  if(row && row.sport) return String(row.sport).toLowerCase();
  try{ const d = JSON.parse(row.data_json || '{}'); return String(d && d.sport || '').toLowerCase(); }catch(e){ return ''; }
}
async function nbaSaveRequiresSubscription(env, userId){
  await ensureGamesSubscriptionSchema(env);
  const user = await env.DB.prepare("SELECT games_subscription_status, games_subscription_ends_at FROM users WHERE id=?").bind(userId).first();
  const active = !!(user && String(user.games_subscription_status||'').toLowerCase()==='active' && (!user.games_subscription_ends_at || Date.parse(user.games_subscription_ends_at) > Date.now()));
  if(active) return false;
  const rs = await env.DB.prepare(`SELECT id, data_json, sport FROM brackets WHERE user_id=?`).bind(userId).all();
  let nbaCount = 0;
  for(const row of (rs.results||[])){
    if(inferSport(row)==='nba') nbaCount++;
  }
  return nbaCount >= 2;
}

export async function onRequest(context){
  const { request, env } = context;
  const user = await requireUser(request, env);
  if(!user) return json({ ok:false, error:'Unauthorized' }, 401);
  await ensureBracketsSchema(env);
  await ensureChallengeEntriesSchema(env);

  if(request.method === 'GET'){
    const rs = await env.DB.prepare(`SELECT id, user_id, title, bracket_name, bracket_type, sport, template_id, layout_type, data_json, created_at, updated_at FROM brackets WHERE user_id=? ORDER BY COALESCE(updated_at, created_at) DESC`).bind(user.id).all();
    const brackets = (rs.results || []).map(r => ({
      ...r,
      sport: inferSport(r) || String(r.sport||'').toLowerCase()
    }));
    try{
      const ce = await env.DB.prepare(`SELECT bracket_id, MAX(CASE WHEN LOWER(challenge)='best' THEN 1 ELSE 0 END) AS entered_best, MAX(CASE WHEN LOWER(challenge)='worst' THEN 1 ELSE 0 END) AS entered_worst FROM challenge_entries GROUP BY bracket_id`).all();
      const entryMap = new Map((ce.results || []).map(row => [String(row.bracket_id || ''), row]));
      for(const b of brackets){ const row = entryMap.get(String(b.id)) || {}; b.entered_best = Number(row.entered_best || 0); b.entered_worst = Number(row.entered_worst || 0); }
    }catch(_e){ for(const b of brackets){ b.entered_best = 0; b.entered_worst = 0; } }
    try{
      const fr = await env.DB.prepare(`SELECT bracket_id, CASE WHEN status IS NULL OR TRIM(status)='' THEN 'pending' ELSE status END AS feature_status FROM feature_requests ORDER BY COALESCE(created_at, submitted_at, updated_at, approved_at) DESC`).all();
      const fmap = new Map();
      for(const row of (fr.results || [])){ const bid = String(row.bracket_id || ''); if(!bid || fmap.has(bid)) continue; fmap.set(bid, String(row.feature_status || '')); }
      for(const b of brackets){ b.feature_status = fmap.get(String(b.id)) || ''; }
    }catch(_e){ for(const b of brackets){ b.feature_status = String(b.feature_status || ''); } }
    return json({ ok:true, brackets });
  }

  if(request.method === 'POST'){
    const body = await request.json().catch(()=>null) || {};
    const desiredTitle = String(body.title || body.bracket_name || '').trim().slice(0, 80);
    const title = desiredTitle || 'My Bracket';
    const bracket_type = normalizeType(body.bracket_type);
    const sport = lower(body.sport || (body.data && body.data.sport) || '');
    const template_id = String(body.template_id || (body.data && body.data.template_id) || '').trim();
    const layout_type = String(body.layout_type || (body.data && body.data.layout_type) || '').trim();
    const data = Object.prototype.hasOwnProperty.call(body, 'data') ? body.data : null;
    const payload = Object.prototype.hasOwnProperty.call(body, 'payload') ? body.payload : null;
    const dupe = await env.DB.prepare(`SELECT id FROM brackets WHERE user_id=? AND title=? LIMIT 1`).bind(user.id, title).first();
    if(dupe) return json({ ok:false, error:'NAME_TAKEN', message:'You already have a bracket with that name.' }, 409);
    if(sport === 'nba' && await nbaSaveRequiresSubscription(env, user.id)) return json({ ok:false, error:'NBA_SUBSCRIPTION_REQUIRED', message:'Unlock more NBA bracket saves for $5.99/month.' }, 402);
    const id = uid(); const now = new Date().toISOString();
    const data_json = (data !== null) ? JSON.stringify(data) : ((payload !== null) ? JSON.stringify(payload) : '{}');
    const legacy_payload = (payload !== null) ? JSON.stringify(payload) : ((data !== null) ? JSON.stringify(data) : '{}');
    await env.DB.prepare(`INSERT INTO brackets (id, user_id, title, bracket_name, data_json, payload, bracket_type, sport, template_id, layout_type, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, user.id, title, title, data_json, legacy_payload, bracket_type, sport || null, template_id || null, layout_type || null, now, now).run();
    return json({ ok:true, id });
  }
  return json({ ok:false, error:'Method not allowed' }, 405);
}
