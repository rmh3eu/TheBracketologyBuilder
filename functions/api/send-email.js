import { sendEmail } from './_util.js';

const SUBJECT = '🏀 The Official Bracket Is Out!';

function buildEmailHtml(){
  return `
  <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto; line-height:1.6; color:#222;">
    <h2 style="text-align:center;">The Official Bracket Is Out! 🏀</h2>

    <p>Fill out your brackets now!</p>

    <p>Head over to <strong>BracketologyBuilder</strong> to build your bracket and enter our challenges.</p>

    <ul>
      <li>🏆 <strong>Best Bracket Challenge</strong></li>
      <li>😈 <strong>Worst Bracket Challenge</strong></li>
    </ul>

    <div style="text-align:center; margin:30px 0;">
      <a href="https://bracketologybuilder.com"
         style="display:inline-block; background:#1e73be; color:#ffffff; padding:14px 24px; text-decoration:none; border-radius:6px; font-weight:bold;">
        Create Your Bracket
      </a>
    </div>

    <p style="text-align:center; font-weight:bold;">Also check out the $200,000 Bracket Challenge:</p>

    <div style="text-align:center; margin:25px 0;">
      <a href="https://record.betonlineaffiliates.ag/_xZrmHTbHGhIoAmwrkE6KlGNd7ZgqdRLk/1/"
         style="display:inline-block; background:#d62828; color:#ffffff; padding:14px 24px; text-decoration:none; border-radius:6px; font-weight:bold;">
        Enter the $200K Contest
      </a>
    </div>
  </div>`;
}

function buildEmailText(){
  return `The Official Bracket Is Out! 🏀

Fill out your brackets now!

Head over to BracketologyBuilder to build your bracket and enter our challenges.

🏆 Best Bracket Challenge
😈 Worst Bracket Challenge

Create Your Bracket:
https://bracketologybuilder.com

Also check out the $200,000 Bracket Challenge:
https://record.betonlineaffiliates.ag/_xZrmHTbHGhIoAmwrkE6KlGNd7ZgqdRLk/1/`;
}

function validEmail(s){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
}

async function getAllRecipients(env){
  const rows = await env.DB.prepare(`
    SELECT DISTINCT TRIM(email) AS email
    FROM users
    WHERE email IS NOT NULL AND TRIM(email) <> ''
  `).all();
  return (rows.results || [])
    .map(r => String(r.email || '').trim())
    .filter(validEmail);
}

async function sendWithConcurrency(items, worker, concurrency=5){
  let i = 0;
  const stats = { sent: 0, failed: 0, errors: [] };
  const runners = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while(true){
      const idx = i++;
      if(idx >= items.length) break;
      const item = items[idx];
      try{
        await worker(item, idx);
        stats.sent += 1;
      }catch(e){
        stats.failed += 1;
        stats.errors.push(`${item}: ${String(e?.message || e || 'Failed')}`);
      }
    }
  });
  await Promise.all(runners);
  return stats;
}

export async function onRequest({ env }){
  try{
    const recipients = await getAllRecipients(env);
    const html = buildEmailHtml();
    const text = buildEmailText();

    const stats = await sendWithConcurrency(recipients, async (to) => {
      await sendEmail(env, to, SUBJECT, html, text);
    }, 5);

    return new Response(
      `Recipients found: ${recipients.length}\nSent: ${stats.sent}\nFailed: ${stats.failed}` + (stats.errors.length ? `\n\nErrors:\n${stats.errors.slice(0,20).join('\n')}` : ''),
      {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
      }
    );
  } catch (e) {
    return new Response(`Failed to send bulk email: ${String(e?.message || e || 'Unknown error')}`, {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
    });
  }
}
