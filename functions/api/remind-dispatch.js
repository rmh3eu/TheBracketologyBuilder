import { json } from './_util.js';

async function ensureTable(env){
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS reminder_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      challenge TEXT NOT NULL,
      created_at TEXT NOT NULL,
      sent_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_reminder_email ON reminder_requests(email);
    CREATE INDEX IF NOT EXISTS idx_reminder_sent_at ON reminder_requests(sent_at);
  `);
}

async function sendEmailViaMailChannels({ to, subject, html, text, from }){
  // MailChannels transactional email API works from Cloudflare Workers.
  // If the domain isn't configured yet, delivery may fail; we'll return the API result.
  const payload = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: from || 'noreply@bracketologybuilder.com', name: 'Bracketology Builder' },
    subject,
    content: [
      { type: 'text/plain', value: text },
      { type: 'text/html', value: html }
    ]
  };

  const resp = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await resp.text();
  return { ok: resp.ok, status: resp.status, body };
}

export async function onRequestPost({ request, env }){
  // This endpoint is called client-side once OFFICIAL_BRACKET_LIVE becomes true.
  // It dispatches queued reminder emails and marks them as sent.
  await ensureTable(env);

  // Only run if official bracket is live
  const s = await env.DB.prepare('SELECT value FROM site_settings WHERE key=?')
    .bind('official_bracket_live')
    .first();
  const live = String(s?.value || '0') === '1' || String(s?.value || 'false') === 'true';
  if(!live) return json({ ok:true, skipped:true, reason:'official bracket not live' });

  // Fetch up to 200 pending reminder requests
  const pending = await env.DB.prepare(
    'SELECT id, email, challenge FROM reminder_requests WHERE sent_at IS NULL ORDER BY id ASC LIMIT 200'
  ).all();
  const rows = pending?.results || [];
  if(rows.length === 0) return json({ ok:true, sent:0 });

  const sentAt = new Date().toISOString();
  let sent = 0;
  const failures = [];

  for(const row of rows){
    const subject = 'Bracketology Builder challenges are now live';
    const link = 'https://bracketologybuilder.com';
    const text = `The Best Bracket and Worst Bracket challenges are now live. Click here to play: ${link}`;
    const html = `<p>The Best Bracket and Worst Bracket challenges are now live.</p><p><a href="${link}">Click here</a> to play.</p>`;

    const r = await sendEmailViaMailChannels({
      to: row.email,
      subject,
      text,
      html,
      from: 'noreply@bracketologybuilder.com'
    });

    if(r.ok){
      await env.DB.prepare('UPDATE reminder_requests SET sent_at=? WHERE id=?')
        .bind(sentAt, row.id)
        .run();
      sent += 1;
    }else{
      failures.push({ id: row.id, email: row.email, status: r.status });
    }
  }

  return json({ ok:true, sent, failures, totalExamined: rows.length });
}
