import { json, requireUser, isAdmin, sendEmail, rateLimit, getSiteDomain } from './_util.js';

export async function onRequest({ request, env }){
  if(request.method !== 'POST') return json({ ok:false, error:'Method not allowed' }, 405);

  const user = await requireUser({ request, env });
  if(!isAdmin(user, env)) return json({ ok:false, error:'Unauthorized' }, 401);

  const rl = await rateLimit(env, `email-test:${user.email}`, 5, 600);
  if(!rl.ok) return json({ ok:false, error:'Rate limited', retryAfter: rl.retryAfter }, 429, { 'retry-after': String(rl.retryAfter) });

  let body = {};
  try{ body = await request.json(); }catch{ body = {}; }

  const to = String(body?.to || env.ADMIN_EMAIL || user.email || '').trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)){
    return json({ ok:false, error:'Invalid to email' }, 400);
  }

  const domain = getSiteDomain(env);
  const subject = body?.subject ? String(body.subject) : 'BracketologyBuilder email test';
  const text = `This is a test email from BracketologyBuilder (${domain}).\n\nIf you received this, email sending is working.`;
  const html = `<p>This is a test email from <strong>BracketologyBuilder</strong> (${domain}).</p><p>If you received this, email sending is working.</p>`;

  try{
    const res = await sendEmail(env, { to, subject, text, html, includeUnsubForEmail: to });
    return json({ ok:true, to, provider: env.RESEND_API_KEY ? 'resend' : 'mailchannels', res });
  }catch(e){
    return json({ ok:false, error: String(e?.message || e || 'Failed') }, 500);
  }
}
