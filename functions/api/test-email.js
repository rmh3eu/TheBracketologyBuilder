import { sendEmail } from './_util.js';

export async function onRequest({ env }) {
  const to = 'rmh3eu@virginia.edu';
  const subject = '🏀 The Official Bracket Is Out!';

  const html = `<!doctype html>
<html>
  <body style="margin:0; padding:24px 0; background:#ffffff; color:#222; font-family:Arial, sans-serif;">
    <div style="max-width:600px; margin:0 auto; line-height:1.6; color:#222; padding:0 16px;">
      <h2 style="text-align:center; margin:0 0 12px; font-size:36px; font-weight:700;">Fill Out Your Brackets Now! 🏀</h2>
      <p style="text-align:center; margin:0 0 24px; font-size:18px;">The Official Bracket Is Out!</p>
      <p style="margin:0 0 16px;">Head over to <strong>BracketologyBuilder</strong> to build your bracket and enter our challenges.</p>
      <ul style="margin:0 0 24px 22px; padding:0;">
        <li style="margin:0 0 8px;">🏆 <strong>Best Bracket Challenge</strong></li>
        <li style="margin:0;">😈 <strong>Worst Bracket Challenge</strong></li>
      </ul>
      <div style="text-align:center; margin:0 0 28px;">
        <a href="https://bracketologybuilder.com" style="display:inline-block; background:#1e73be; color:#ffffff; padding:14px 24px; text-decoration:none; border-radius:6px; font-weight:700;">Create Your Bracket</a>
      </div>
      <p style="text-align:center; margin:0 0 18px; font-weight:700;">Also check out the $200,000 Bracket Challenge:</p>
      <div style="text-align:center; margin:0;">
        <a href="https://record.betonlineaffiliates.ag/_xZrmHTbHGhIoAmwrkE6KlGNd7ZgqdRLk/1/" style="display:inline-block; background:#d62828; color:#ffffff; padding:14px 24px; text-decoration:none; border-radius:6px; font-weight:700;">Enter the $200K Contest</a>
      </div>
    </div>
  </body>
</html>`;

  const text = `Fill Out Your Brackets Now! 🏀

The Official Bracket Is Out!

Head over to BracketologyBuilder to build your bracket and enter our challenges.

🏆 Best Bracket Challenge
😈 Worst Bracket Challenge

Create Your Bracket:
https://bracketologybuilder.com

Also check out the $200,000 Bracket Challenge:
https://record.betonlineaffiliates.ag/_xZrmHTbHGhIoAmwrkE6KlGNd7ZgqdRLk/1/`;

  try {
    await sendEmail(env, to, subject, html, text);
    return new Response('Test email sent to rmh3eu@virginia.edu', {
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
