import { requireUser, isAdmin } from './_util.js';
import { sendOne, SUBJECT } from './_nba_brackets_email.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function loadRecipients(env){
  const emails = [];
  const seen = new Set();

  const push = (value) => {
    const email = String(value || '').trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    if(seen.has(email)) return;
    seen.add(email);
    emails.push(email);
  };

  try{
    const leads = await env.DB.prepare(
      `SELECT email
         FROM marketing_leads
        WHERE unsubscribed_at IS NULL
          AND (optin_live=1 OR optin_upcoming=1 OR optin_offers=1)
        ORDER BY updated_at DESC, created_at DESC`
    ).all();
    for(const row of (leads.results || [])) push(row.email);
  }catch(_e){}

  try{
    const users = await env.DB.prepare(
      `SELECT email
         FROM users
        WHERE email IS NOT NULL AND TRIM(email) != ''
        ORDER BY created_at DESC`
    ).all();
    for(const row of (users.results || [])) push(row.email);
  }catch(_e){}

  return emails;
}

export async function onRequest({ request, env }) {
  const user = await requireUser({ request, env });
  if(!isAdmin(user, env)){
    return new Response('Unauthorized', { status: 401, headers: { 'content-type':'text/plain; charset=utf-8', 'cache-control':'no-store' } });
  }

  const url = new URL(request.url);
  const offset = Math.max(0, Number(url.searchParams.get('offset') || '0'));
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit') || '25')));
  const pauseMs = Math.max(400, Math.min(5000, Number(url.searchParams.get('pauseMs') || '1200')));

  const allRecipients = await loadRecipients(env);
  const recipients = allRecipients.slice(offset, offset + limit);

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
    if(to !== recipients[recipients.length - 1]){
      await sleep(pauseMs);
    }
  }

  const nextOffset = offset + recipients.length;
  const hasMore = nextOffset < allRecipients.length;
  const nextUrl = hasMore
    ? `${url.origin}/api/send-nba-brackets-email-batch?offset=${nextOffset}&limit=${limit}&pauseMs=${pauseMs}`
    : '';

  return new Response(
    [
      `Subject: ${SUBJECT}`,
      `Recipients available: ${allRecipients.length}`,
      `Offset: ${offset}`,
      `Limit: ${limit}`,
      `Pause ms: ${pauseMs}`,
      `This batch: ${recipients.length}`,
      `Sent: ${sent}`,
      `Failed: ${failed}`,
      `Has more: ${hasMore ? 'yes' : 'no'}`,
      hasMore ? `Next batch URL: ${nextUrl}` : 'Next batch URL: none',
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
