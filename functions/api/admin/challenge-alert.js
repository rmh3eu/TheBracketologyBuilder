import { json, requireUser, isAdmin, rateLimit, sendResendEmail, getSiteDomain, randomB64, isValidEmail, normalizeEmail } from "../_util.js";

async function ensureLeadTables(env){
  const stmts = [
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
    );`,
    `CREATE INDEX IF NOT EXISTS idx_mkt_updated ON marketing_leads(updated_at);`,
    `CREATE INDEX IF NOT EXISTS idx_mkt_unsub ON marketing_leads(unsubscribed_at);`
  ];
  for(const sql of stmts){
    try{ await env.DB.prepare(sql).run(); }catch(e){}
  }

  const info = await env.DB.prepare("PRAGMA table_info(marketing_leads)").all().catch(()=>({results:[]}));
  const cols = (info.results||[]).map(r=>r.name);
  const add = async (sql) => { try{ await env.DB.prepare(sql).run(); }catch(e){} };
  if(!cols.includes("unsub_token")) await add("ALTER TABLE marketing_leads ADD COLUMN unsub_token TEXT");

  // Backfill tokens (best-effort)
  try{
    const rows = await env.DB.prepare("SELECT email FROM marketing_leads WHERE unsub_token IS NULL OR unsub_token=''").all();
    for(const r of (rows.results||[])){
      try{
        await env.DB.prepare("UPDATE marketing_leads SET unsub_token=? WHERE email=?").bind(randomB64(24), r.email).run();
      }catch(e){}
    }
  }catch(e){}
}

function isValidDestination(s){
  try{
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:';
  }catch{ return false; }
}

async function sendWithConcurrency(items, worker, { concurrency = 1, delayMs = 300 } = {}){
  // NOTE: Resend enforces fairly low rate limits on some plans (e.g. ~2 req/sec).
  // We keep concurrency at 1 and add a small delay to avoid 429s.
  concurrency = Math.max(1, Math.min(1, Number(concurrency) || 1)); // force 1

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const results = [];
  for (const item of items) {
    let attempt = 0;
    while (true) {
      attempt++;
      try {
        results.push(await worker(item));
        break;
      } catch (err) {
        const msg = String(err && (err.message || err));
        // If we hit rate limits, backoff and retry a couple times.
        if (msg.includes('429') && attempt <= 3) {
          await sleep(800 * attempt);
          continue;
        }
        throw err;
      }
    }
    if (delayMs) await sleep(delayMs);
  }
  return results;
}

export async function onRequestPost({ request, env }){
  const user = await requireUser({ request, env });
  if(!isAdmin(user, env)) return json({ ok:false, error:"Not authorized." }, 403);

  // Admin rate limit
  const rl = await rateLimit(env, `admin-alert:${user?.id||'x'}`, 8, 900);
  if(!rl.ok) return json({ ok:false, error:'RATE_LIMIT', message:'Too many sends. Try again soon.' }, 429, { 'retry-after': String(rl.retryAfter) });

  const body = await request.json().catch(()=>({}));
  const subject = String(body?.subject || '').trim().slice(0, 120);
  const message = String(body?.message || '').trim().slice(0, 4000);
  const link = String(body?.link || '').trim().slice(0, 600);
  const segment = String(body?.segment || 'live').trim().toLowerCase();

  if(!subject) return json({ ok:false, error:'MISSING_SUBJECT', message:'Subject is required.' }, 400);
  if(!message) return json({ ok:false, error:'MISSING_MESSAGE', message:'Message is required.' }, 400);
  let finalLink = '';
  if(link){
    if(link.startsWith('/')){
      const domain = getSiteDomain(env);
      finalLink = `https://${domain}${finalLink}`;
    }else if(isValidDestination(link)){
      finalLink = link;
    }else{
      return json({ ok:false, error:'INVALID_LINK', message:'Link must be a relative path or full https URL.' }, 400);
    }
  }

  await ensureLeadTables(env);

  // Pull recipients
  const segCol = (segment === 'upcoming') ? 'optin_upcoming'
               : (segment === 'offers') ? 'optin_offers'
               : 'optin_live';

  const rs = await env.DB.prepare(
    `SELECT email, unsub_token FROM marketing_leads
     WHERE ${segCol}=1 AND (unsubscribed_at IS NULL OR unsubscribed_at='')
     ORDER BY updated_at DESC`
  ).all();
  const rows = rs.results || [];
  // Normalize + validate emails, and dedupe by email (prevents partial/invalid addresses from being used).
  const cleanedRows = [];
  const seenEmails = new Set();
  for (const r of rows) {
    const email = normalizeEmail(r.email);
    if (!isValidEmail(email)) continue;
    if (seenEmails.has(email)) continue;
    seenEmails.add(email);
    cleanedRows.push({ ...r, email });
  }
  if(!cleanedRows.length) return json({ ok:true, sent:0, message:'No valid opted-in recipients found.' });

  

  const domain = getSiteDomain(env);
  const base = `https://${domain}`;

  const htmlFor = (row) => {
    const unsub = `${base}/unsubscribe.html?t=${encodeURIComponent(row.unsub_token||'')}`;
    const button = finalLink ? `<p><a href="${finalLink}" style="display:inline-block;padding:12px 16px;border-radius:12px;background:#111827;color:#fff;text-decoration:none;font-weight:800">Open Challenge</a></p>` : '';
    return `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5">
        <h2 style="margin:0 0 10px">${subject.replace(/</g,'&lt;')}</h2>
        <p style="margin:0 0 14px;white-space:pre-wrap">${message.replace(/</g,'&lt;')}</p>
        ${button}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:18px 0" />
        <p style="font-size:12px;color:#6b7280;margin:0">
          ${segment === "offers" ? "You’re receiving this because you opted in to betting partner offers on Bracketology Builder." : (segment === "upcoming" ? "You’re receiving this because you opted in to upcoming challenge notifications on Bracketology Builder." : "You’re receiving this because you opted in to official bracket go-live alerts on Bracketology Builder.")}
          <br/>
          <a href="${unsub}" style="color:#6b7280">Unsubscribe</a>
        </p>
      </div>
    `;
  };

  const textFor = (row) => {
    const unsub = `${base}/unsubscribe.html?t=${encodeURIComponent(row.unsub_token||'')}`;
    return `${subject}\n\n${message}\n\n${link ? `Open: ${finalLink}\n\n` : ''}Unsubscribe: ${unsub}`;
  };

  // Send emails (requires RESEND_API_KEY)
  const summary = await sendWithConcurrency(cleanedRows, async (row) => {
    await sendResendEmail(env, row.email, subject, htmlFor(row), textFor(row));
  }, 8);

  return json({ ok:true, recipients: cleanedRows.length, sent: summary.ok, failed: summary.fail });
}