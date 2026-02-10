import { json, requireUser } from './_util.js';

async function ensureTables(env){
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS reminder_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      challenge TEXT NOT NULL,
      created_at TEXT NOT NULL,
      sent_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_reminder_email ON reminder_requests(email);
    CREATE INDEX IF NOT EXISTS idx_reminder_sent ON reminder_requests(sent_at);

    CREATE TABLE IF NOT EXISTS reminder_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      email TEXT,
      phone TEXT,
      kind TEXT NOT NULL,
      created_at TEXT NOT NULL,
      email_optin INTEGER DEFAULT 0,
      sms_optin INTEGER DEFAULT 0,
      email_sent_at TEXT,
      sms_sent_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_remq_kind ON reminder_queue(kind);
    CREATE INDEX IF NOT EXISTS idx_remq_email_sent ON reminder_queue(email_sent_at);
    CREATE INDEX IF NOT EXISTS idx_remq_sms_sent ON reminder_queue(sms_sent_at);
  `);
}

export async function onRequest({ request, env }){
  if(request.method !== 'POST') return json({ ok:false, error:'Method not allowed' }, 405);
  try{
    await ensureTables(env);
    const body = await request.json();
    const challenge = String(body?.challenge || '').toLowerCase();
    if(challenge !== 'best' && challenge !== 'worst'){
      return json({ ok:false, error:'Invalid challenge.' }, 400);
    }

    // Require login so we can safely use the account email and opt-in prefs
    const user = await requireUser({ request, env });

    const email = String(user.email || '').trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
      return json({ ok:false, error:'Invalid email.' }, 400);
    }

    const now = new Date().toISOString();

    // Avoid duplicates: one pending reminder per email+challenge.
    const existing = await env.DB.prepare(
      'SELECT id FROM reminder_requests WHERE email=? AND challenge=? AND sent_at IS NULL LIMIT 1'
    ).bind(email, challenge).first();
    if(existing){
      return json({ ok:true, already:true });
    }

    await env.DB.prepare(
      'INSERT INTO reminder_requests (email, challenge, created_at) VALUES (?,?,?)'
    ).bind(email, challenge, now).run();

    // Also enqueue into the unified reminder queue (for email + sms)
    // Use user's stored opt-ins.
    const phone = user.phone ? String(user.phone) : null;
    const emailOpt = user.optin_email ? 1 : 0;
    const smsOpt = user.optin_sms ? 1 : 0;

    // Only enqueue if at least one channel is opted in
    if(emailOpt || smsOpt){
      // De-dupe by email+kind when not sent
      const q = await env.DB.prepare(
        "SELECT id FROM reminder_queue WHERE email=? AND kind='challenges_live' AND (email_sent_at IS NULL OR sms_sent_at IS NULL) LIMIT 1"
      ).bind(email).first();
      if(!q){
        await env.DB.prepare(
          "INSERT INTO reminder_queue (user_id, email, phone, kind, created_at, email_optin, sms_optin) VALUES (?,?,?,?,?,?,?)"
        ).bind(user.id, email, phone, 'challenges_live', now, emailOpt, smsOpt).run();
      }
    }

    return json({ ok:true });
  }catch(e){
    return json({ ok:false, error: String(e?.message || e || 'Failed') }, 500);
  }
}
