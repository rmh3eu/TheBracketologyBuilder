import { requireUser, isAdmin } from './_util.js';
import { sendOne, SUBJECT } from './_nba_brackets_email.js';

export async function onRequest({ request, env }) {
  const user = await requireUser({ request, env });
  if(!isAdmin(user, env)){
    return new Response('Unauthorized', { status: 401, headers: { 'content-type':'text/plain; charset=utf-8', 'cache-control':'no-store' } });
  }

  const url = new URL(request.url);
  const to = String(url.searchParams.get('to') || env.ADMIN_EMAIL || user.email || '').trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)){
    return new Response('Invalid to email. Use ?to=you@example.com', { status: 400, headers: { 'content-type':'text/plain; charset=utf-8', 'cache-control':'no-store' } });
  }

  try{
    await sendOne(env, to);
    return new Response([
      'Test NBA brackets email sent.',
      `To: ${to}`,
      `Subject: ${SUBJECT}`,
      '',
      'This route requires you to be signed in as admin.'
    ].join('\n'), {
      status: 200,
      headers: { 'content-type':'text/plain; charset=utf-8', 'cache-control':'no-store' }
    });
  }catch(e){
    return new Response(`Failed to send test email: ${String(e?.message || e || 'Unknown error')}`, {
      status: 500,
      headers: { 'content-type':'text/plain; charset=utf-8', 'cache-control':'no-store' }
    });
  }
}
