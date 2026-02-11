import { json, getIp, rateLimit, randomB64, normalizeEmail, isValidEmail } from './_util.js';

async function ensureLeadTables(env){
  // IMPORTANT: D1 can be picky about multi-statement exec strings during builds.
  // Keep schema setup as single statements for maximum compatibility.
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS marketing_leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      optin_live INTEGER NOT NULL DEFAULT 0,
      optin_upcoming INTEGER NOT NULL DEFAULT 0,
      optin_offers INTEGER NOT NULL DEFAULT 0,
      source TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      unsubscribed_at TEXT,
      unsub_token TEXT,
      consent_ip TEXT
    );`
  ).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_mkt_updated ON marketing_leads(updated_at);`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_mkt_unsub ON marketing_leads(unsubscribed_at);`).run();

  // If the table existed from older zips, add missing columns safely.
  const info = await env.DB.prepare("PRAGMA table_info(marketing_leads)").all().catch(()=>({results:[]}));
  const cols = (info.results||[]).map(r=>r.name);
  const add = async (sql) => { try{ await env.DB.prepare(sql).run(); }catch(e){} };
  // Older zips may have used different column names; keep compatibility.
  if(!cols.includes("optin_offers")){
    await add("ALTER TABLE marketing_leads ADD COLUMN optin_offers INTEGER NOT NULL DEFAULT 0");
    // If an older column exists, backfill.
    if(cols.includes("optin_betting")){
      try{ await env.DB.prepare("UPDATE marketing_leads SET optin_offers=optin_betting WHERE optin_offers=0 AND optin_betting=1").run(); }catch(e){}
    }
  }
  if(!cols.includes("unsub_token")) await add("ALTER TABLE marketing_leads ADD COLUMN unsub_token TEXT");

  // Backfill tokens so every lead has an unsubscribe token.
  try{
    await env.DB.prepare("UPDATE marketing_leads SET unsub_token=? WHERE unsub_token IS NULL OR unsub_token=''").bind(randomB64(24)).run();
  }catch(e){}
}



export async function onRequest({ request, env }){
  if(request.method !== 'POST') return json({ ok:false, error:'Method not allowed' }, 405);
  try{
    if(!env || !env.DB) return json({ ok:false, error:'MISSING_DB' }, 500);
    const ip = getIp(request);
    // Be tolerant of non-JSON posts (some browsers/extensions can force a form submit).
    let body = null;
    try{
      body = await request.json();
    }catch(_e){
      const t = await request.text().catch(()=> '');
      const p = new URLSearchParams(t);
      body = {
        email: p.get('email') || '',
        source: p.get('source') || '',
        optin_live: p.get('optin_live') || p.get('optinLive') || '',
        optin_upcoming: p.get('optin_upcoming') || p.get('optinUpcoming') || '',
        optin_offers: p.get('optin_offers') || p.get('optinOffers') || p.get('optin_betting') || ''
      };
    }

    const email = String(body?.email || '').trim().toLowerCase();
    const source = String(body?.source || '').trim().slice(0, 80);
    const optinLive = !!body?.optin_live;
    const optinUpcoming = !!body?.optin_upcoming;
    const optinOffers = !!(body?.optin_offers ?? body?.optin_betting ?? body?.optin_bets);

    if(!email || !isValidEmail(email)) return json({ ok:false, error:'INVALID_EMAIL', message:'Enter a valid email.' }, 400);
    if(!(optinLive || optinUpcoming || optinOffers)){
      return json({ ok:false, error:'NO_SELECTION', message:'Select at least one alert type.' }, 400);
    }

    // Rate limit to prevent list abuse.
    const rl = await rateLimit(env, `lead:${ip}:${email}`, 20, 600);
    if(!rl.ok) return json({ ok:false, error:'RATE_LIMIT', message:'Too many attempts. Try again soon.' }, 429, { 'retry-after': String(rl.retryAfter) });

    await ensureLeadTables(env);
    const now = new Date().toISOString();

    // Upsert: if exists, update prefs and clear unsubscribe if user re-opted.
    const existing = await env.DB.prepare('SELECT id FROM marketing_leads WHERE email=? LIMIT 1').bind(email).first();
    if(existing){
      await env.DB.prepare(
        `UPDATE marketing_leads
           SET optin_live = CASE WHEN optin_live=1 OR ?=1 THEN 1 ELSE optin_live END,
               optin_upcoming = CASE WHEN optin_upcoming=1 OR ?=1 THEN 1 ELSE optin_upcoming END,
               optin_offers = CASE WHEN optin_offers=1 OR ?=1 THEN 1 ELSE optin_offers END,
               source=?,
               updated_at=?,
               consent_ip=?,
               unsub_token=COALESCE(NULLIF(unsub_token,''), ?)
         WHERE email=?`
      ).bind(optinLive?1:0, optinUpcoming?1:0, optinOffers?1:0, source||null, now, ip, randomB64(24), email).run();
      return json({ ok:true, updated:true });
    }

    await env.DB.prepare(
      'INSERT INTO marketing_leads (email,optin_live,optin_upcoming,optin_offers,source,created_at,updated_at,consent_ip,unsub_token) VALUES (?,?,?,?,?,?,?,?,?)'
    ).bind(email, optinLive?1:0, optinUpcoming?1:0, optinOffers?1:0, source||null, now, now, ip, randomB64(24)).run();

    return json({ ok:true, created:true });
  }catch(e){
    return json({ ok:false, error: String(e?.message || e || 'Failed') }, 500);
  }
}
