import { json, requireUser, isAdmin } from "../_util.js";

async function ensureQueue(env){
  await env.DB.exec(`
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

async function sendEmailViaMailChannels({ to, subject, html, text, from }){
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

async function sendSmsTwilio({ to, body, env }){
  // Requires env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN, env.TWILIO_FROM
  const sid = env.TWILIO_ACCOUNT_SID;
  const token = env.TWILIO_AUTH_TOKEN;
  const from = env.TWILIO_FROM;
  if(!sid || !token || !from){
    return { ok:false, skipped:true, reason:"Twilio not configured" };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth = btoa(`${sid}:${token}`);
  const form = new URLSearchParams();
  form.set("To", to);
  form.set("From", from);
  form.set("Body", body);

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "authorization": `Basic ${auth}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    body: form.toString()
  });

  const txt = await resp.text();
  return { ok: resp.ok, status: resp.status, body: txt };
}

export async function onRequestPost({ request, env }){
  const user = await requireUser({request, env});
  if(!isAdmin(user, env)) return json({ok:false, error:"Not authorized."}, 403);

  await ensureQueue(env);

  // Only send if official bracket is live (site_setting)
  // If the key doesn't exist, default is not live.
  let live = false;
  try{
    const s = await env.DB.prepare('SELECT value_text FROM site_settings WHERE key=?')
      .bind('official_bracket_live').first();
    const v = String(s?.value_text || '0').toLowerCase();
    live = (v === '1' || v === 'true' || v === 'yes');
  }catch(_e){ live = false; }

  if(!live) return json({ ok:true, skipped:true, reason:"official bracket not live" });

  const link = (env.PUBLIC_BASE_URL || "https://bracketologybuilder.com");
  const subject = "Bracketology Builder challenges are now live";
  const text = `The best bracket and worst bracket challenges are now live. Click here to play: ${link}`;
  const html = `<p>The best bracket and worst bracket challenges are now live.</p><p><a href="${link}">Click here</a> to play.</p>`;

  // Send up to 200 at a time
  const rs = await env.DB.prepare(
    `SELECT id, email, phone, email_optin, sms_optin
     FROM reminder_queue
     WHERE kind='challenges_live'
       AND ( (email_optin=1 AND email_sent_at IS NULL) OR (sms_optin=1 AND sms_sent_at IS NULL) )
     ORDER BY id ASC
     LIMIT 200`
  ).all();

  const rows = rs?.results || [];
  if(rows.length === 0) return json({ ok:true, sentEmail:0, sentSms:0, totalExamined:0 });

  const now = new Date().toISOString();
  let sentEmail = 0;
  let sentSms = 0;
  const failures = [];

  for(const row of rows){
    // Email
    if(row.email_optin === 1 && row.email && !row.email_sent_at){
      const r = await sendEmailViaMailChannels({
        to: row.email,
        subject,
        text,
        html,
        from: 'noreply@bracketologybuilder.com'
      });
      if(r.ok){
        await env.DB.prepare('UPDATE reminder_queue SET email_sent_at=? WHERE id=?').bind(now, row.id).run();
        sentEmail += 1;
      }else{
        failures.push({ id: row.id, channel:'email', status: r.status });
      }
    }

    // SMS
    if(row.sms_optin === 1 && row.phone && !row.sms_sent_at){
      const smsBody = `Best + Worst Bracket Challenges are now live! Play: ${link}`;
      const r = await sendSmsTwilio({ to: row.phone, body: smsBody, env });
      if(r.ok){
        await env.DB.prepare('UPDATE reminder_queue SET sms_sent_at=? WHERE id=?').bind(now, row.id).run();
        sentSms += 1;
      }else{
        // don't mark sent; record failure
        failures.push({ id: row.id, channel:'sms', status: r.status || 0, reason: r.reason || r.body || 'failed' });
      }
    }
  }

  return json({ ok:true, sentEmail, sentSms, failures, totalExamined: rows.length });
}
