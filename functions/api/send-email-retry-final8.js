import { sendEmail } from './_util.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const RECIPIENTS = [
  "cjpotter@stu.neperville203.org",
  "hufmane49@gmail.com",
  "tenoble306@icloud.com",
  "kd7daly@yahoo.com",
  "lenquinrayan@yahoo.com",
  "tucker.whitmire@icloud.com",
  "vincent1kul@gmail.com",
  "bruce.brayden26@markesan.k12.wi.us"
];

export async function onRequest({ env }) {
  const subject = '🏀 The Official Bracket Is Out!';

  const html = `
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
         style="display:inline-block;background:#1e73be;color:#ffffff;padding:14px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">
        Create Your Bracket
      </a>
    </div>

    <p style="text-align:center; font-weight:bold;">Also check out the $200,000 Bracket Challenge:</p>

    <div style="text-align:center; margin:25px 0;">
      <a href="https://record.betonlineaffiliates.ag/_xZrmHTbHGhJW0dkOQ7qvdWNd7ZgqdRLk/1/"
         style="display:inline-block;background:#d62828;color:#ffffff;padding:14px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">
        Enter the $200K Contest
      </a>
    </div>
  </div>`;

  const text = `The Official Bracket Is Out! 🏀

Fill out your brackets now!

Head over to BracketologyBuilder to build your bracket and enter our challenges.

🏆 Best Bracket Challenge
😈 Worst Bracket Challenge

Create Your Bracket:
https://bracketologybuilder.com

Also check out the $200,000 Bracket Challenge:
https://record.betonlineaffiliates.ag/_xZrmHTbHGhJW0dkOQ7qvdWNd7ZgqdRLk/1/`;

  let sent = 0;
  let failed = 0;
  const errors = [];

  for (const to of RECIPIENTS) {
    try {
      await sendEmail(env, to, subject, html, text);
      sent++;
    } catch (e) {
      failed++;
      errors.push(`${to}: ${String(e?.message || e || 'Unknown error')}`);
    }
    await sleep(1200);
  }

  return new Response(
    [
      `Recipients: ${RECIPIENTS.length}`,
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
