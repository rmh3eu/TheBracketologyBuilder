import { json, randomB64 } from './_util.js';

async function ensureLeadTables(env){
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS marketing_leads (
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
    );
    CREATE INDEX IF NOT EXISTS idx_mkt_updated ON marketing_leads(updated_at);
    CREATE INDEX IF NOT EXISTS idx_mkt_unsub ON marketing_leads(unsubscribed_at);
  `);

  const info = await env.DB.prepare("PRAGMA table_info(marketing_leads)").all().catch(()=>({results:[]}));
  const cols = (info.results||[]).map(r=>r.name);
  const add = async (sql) => { try{ await env.DB.prepare(sql).run(); }catch(e){} };
  if(!cols.includes("unsub_token")) await add("ALTER TABLE marketing_leads ADD COLUMN unsub_token TEXT");

  // best-effort backfill
  try{
    await env.DB.prepare("UPDATE marketing_leads SET unsub_token=? WHERE unsub_token IS NULL OR unsub_token=''").bind(randomB64(24)).run();
  }catch(e){}
}

export async function onRequest({ request, env }){
  if(request.method !== 'POST') return json({ ok:false, error:'Method not allowed' }, 405);
  try{
    if(!env || !env.DB) return json({ ok:false, error:'MISSING_DB' }, 500);
    const body = await request.json().catch(()=>({}));
    const token = String(body?.token || '').trim();
    if(!token) return json({ ok:false, error:'MISSING_TOKEN', message:'Missing token.' }, 400);

    await ensureLeadTables(env);

    const now = new Date().toISOString();
    const lead = await env.DB.prepare("SELECT id FROM marketing_leads WHERE unsub_token=? LIMIT 1").bind(token).first();
    if(!lead) return json({ ok:false, error:'NOT_FOUND', message:'Unsubscribe link is invalid or expired.' }, 404);

    await env.DB.prepare("UPDATE marketing_leads SET unsubscribed_at=?, updated_at=? WHERE unsub_token=?")
      .bind(now, now, token).run();

    return json({ ok:true });
  }catch(e){
    return json({ ok:false, error: String(e?.message || e || 'Failed') }, 500);
  }
}