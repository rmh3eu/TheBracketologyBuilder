import { sendEmail } from './_util.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function buildEmail(){
  const subject = 'Second Chance Brackets Close Tomorrow';

  const html = `
  <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto; line-height:1.6; color:#222;">
    <h2 style="text-align:center;">Second Chance Brackets Close Tomorrow</h2>

    <p>There’s still time to submit your Second Chance bracket and compete for prizes.</p>

    <p>Make your picks before it’s too late.</p>

    <div style="text-align:center; margin:28px 0;">
      <a href="https://bracketologybuilder.com"
         style="display:inline-block; background:#1e73be; color:#ffffff; padding:14px 24px; text-decoration:none; border-radius:6px; font-weight:bold;">
        Enter Your Second Chance Bracket
      </a>
    </div>

    <p>We still have plenty of prizes to give out.</p>

    <p>Also, feel free to check out our new Bracket Games Feature to play fun sports trivia games.</p>

    <div style="text-align:center; margin:22px 0;">
      <a href="https://bracketologybuilder.com/bracket-games.html"
         style="display:inline-block; background:#111827; color:#ffffff; padding:12px 22px; text-decoration:none; border-radius:6px; font-weight:bold;">
        Play Bracket Games
      </a>
    </div>

    <p>Good luck,<br>BracketologyBuilder</p>
  </div>`;

  const text = `Second Chance Brackets Close Tomorrow

There’s still time to submit your Second Chance bracket and compete for prizes.

Make your picks before it’s too late.

Enter Your Second Chance Bracket:
https://bracketologybuilder.com

We still have plenty of prizes to give out.

Also, feel free to check out our new Bracket Games Feature to play fun sports trivia games.
Play Bracket Games:
https://bracketologybuilder.com/bracket-games.html

Good luck,
BracketologyBuilder`;

  return { subject, html, text };
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);

  const mode = String(url.searchParams.get('mode') || '').trim().toLowerCase();
  const testTo = String(url.searchParams.get('to') || '').trim();

  const offset = Math.max(0, Number.parseInt(url.searchParams.get('offset') || '0', 10) || 0);
  const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('limit') || '25', 10) || 25));
  const delayMs = Math.min(5000, Math.max(0, Number.parseInt(url.searchParams.get('delayMs') || '700', 10) || 700));

  const { subject, html, text } = buildEmail();

  if (mode === 'test') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testTo)) {
      return new Response('Invalid or missing test email. Use ?mode=test&to=you@example.com', {
        status: 400,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
      });
    }

    try {
      await sendEmail(env, testTo, subject, html, text);
      return new Response(`Test email sent to ${testTo}`, {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
      });
    } catch (e) {
      return new Response(`Failed to send test email: ${String(e?.message || e || 'Unknown error')}`, {
        status: 500,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
      });
    }
  }

  const rs = await env.DB.prepare(
    "SELECT DISTINCT TRIM(email) AS email FROM users WHERE email IS NOT NULL AND TRIM(email) != '' ORDER BY created_at DESC"
  ).all();

  const allRecipients = (rs.results || [])
    .map(r => String(r.email || '').trim())
    .filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

  const recipients = allRecipients.slice(offset, offset + limit);

  let sent = 0;
  let failed = 0;
  const errors = [];

  for (const to of recipients) {
    try {
      await sendEmail(env, to, subject, html, text);
      sent++;
    } catch (e) {
      failed++;
      errors.push(`${to}: ${String(e?.message || e || 'Unknown error')}`);
    }
    if (delayMs > 0) await sleep(delayMs);
  }

  return new Response(
    [
      `Total recipients found: ${allRecipients.length}`,
      `Offset: ${offset}`,
      `Limit: ${limit}`,
      `This batch: ${recipients.length}`,
      `Sent: ${sent}`,
      `Failed: ${failed}`,
      '',
      ...(errors.length ? ['Errors:', ...errors] : ['No errors.']),
      '',
      'Test URL format:',
      '/api/send-second-chance?mode=test&to=you@example.com',
      '',
      'Live URL examples:',
      '/api/send-second-chance?offset=0&limit=25',
      '/api/send-second-chance?offset=25&limit=50',
      '/api/send-second-chance?offset=75&limit=50'
    ].join('\n'),
    {
      status: 200,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store'
      }
    }
  );
}
