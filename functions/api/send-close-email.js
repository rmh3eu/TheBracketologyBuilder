import { sendOne } from './_brackets_close_email.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function onRequest({ env }) {
  const rs = await env.DB.prepare(
    "SELECT DISTINCT TRIM(email) AS email FROM users WHERE email IS NOT NULL AND TRIM(email) != '' ORDER BY created_at DESC"
  ).all();

  const recipients = (rs.results || [])
    .map(r => String(r.email || '').trim())
    .filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

  let sent = 0;
  let failed = 0;
  const errors = [];

  for (const to of recipients) {
    try {
      await sendOne(env, to);
      sent++;
    } catch (e) {
      failed++;
      errors.push(`${to}: ${String(e?.message || e || 'Unknown error')}`);
    }
    await sleep(650);
  }

  return new Response(
    [
      `Recipients found: ${recipients.length}`,
      `Sent: ${sent}`,
      `Failed: ${failed}`,
      '',
      ...(errors.length ? ['Errors:', ...errors] : ['No errors.'])
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
