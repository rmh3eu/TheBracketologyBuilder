import { sendEmail } from './_util.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function esc(s){
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildEmail(){
  const subject = 'Second Chance Brackets are LIVE 🏀';

  const html = `
  <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto; line-height:1.6; color:#222;">
    <h2 style="text-align:center;">Second Chance Brackets are LIVE 🏀</h2>

    <p>The Sweet 16 is here. Your second chance is too.</p>

    <p>We just launched <strong>Second Chance Brackets</strong> on BracketologyBuilder.</p>

    <p>Even if your original bracket is busted, you can jump back in and compete from here on out.</p>

    <p>We still have <strong>a lot of prizes left to give out</strong>.</p>

    <p>It takes less than a minute to enter.</p>

    <div style="text-align:center; margin:28px 0;">
      <a href="https://bracketologybuilder.com"
         style="display:inline-block; background:#1e73be; color:#ffffff; padding:14px 24px; text-decoration:none; border-radius:6px; font-weight:bold;">
        Start Now
      </a>
    </div>

    <p>Also, feel free to check out our new NBA Playoffs projected bracket:</p>

    <div style="text-align:center; margin:22px 0;">
      <a href="https://bracketologybuilder.com/nba"
         style="display:inline-block; background:#111827; color:#ffffff; padding:12px 22px; text-decoration:none; border-radius:6px; font-weight:bold;">
        View NBA Bracket
      </a>
    </div>
  </div>`;

  const text = `Second Chance Brackets are LIVE 🏀

The Sweet 16 is here. Your second chance is too.

We just launched Second Chance Brackets on BracketologyBuilder.

Even if your original bracket is busted, you can jump back in and compete from here on out.

We still have a lot of prizes left to give out.

It takes less than a minute to enter.

Start now:
https://bracketologybuilder.com

Also, feel free to check out our new NBA Playoffs projected bracket:
https://bracketologybuilder.com/nba`;

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

  // TEST MODE: /api/send-second-chance?mode=test&to=you@example.com
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

  // LIVE MODE:
  // /api/send-second-chance?offset=0&limit=25
  // /api/send-second-chance?offset=25&limit=50
  // /api/send-second-chance?offset=75&limit=50
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
