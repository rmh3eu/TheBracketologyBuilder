// v221 tweak
// v220 route fix
import { sendEmail } from './_util.js';

export const SUBJECT = 'Brackets Close at 12:15 PM EST🏀';
export const TEST_TO = 'rmh3eu@virginia.edu';
export const AFFILIATE_URL = 'https://record.betonlineaffiliates.ag/_xZrmHTbHGhJW0dkOQ7qvdWNd7ZgqdRLk/1/';
export const SITE_URL = 'https://bracketologybuilder.com';

export function buildEmail(){
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f5f5f5;padding:20px;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;padding:30px;border-radius:12px;text-align:center;">

      <h1 style="margin-bottom:20px;">Brackets Close at 12:15 PM EST🏀</h1>

      <p style="font-size:16px;line-height:1.6;">
        There’s still time to enter our bracket challenges.
      </p>

      <p style="font-size:16px;line-height:1.6;font-weight:bold;">
        There’s limited entries so you’d have a great chance at winning a prize!
      </p>

      <div style="margin:25px 0;">
        <a href="${SITE_URL}" style="background:#2563eb;color:#fff;padding:14px 26px;border-radius:999px;text-decoration:none;font-weight:800;">
          Click here to enter before it’s too late!
        </a>
      </div>

      <p style="margin-top:25px;font-size:16px;">
        Also, be sure to enter the 200k Bracket Contest hosted by BetOnline
      </p>

      <div style="margin:20px 0;">
        <a href="${AFFILIATE_URL}" style="background:#111;color:#fff;padding:14px 26px;border-radius:999px;text-decoration:none;font-weight:800;">
          Enter the $200K Bracket Contest
        </a>
      </div>

      <p style="margin-top:25px;font-size:16px;">
        Hurry up and good luck!
      </p>

    </div>
  </div>`;

  const text = `Brackets Close at 12:15 PM EST🏀

There’s still time to enter our bracket challenges.

There’s limited entries so you’d have a great chance at winning a prize!

Enter here: ${SITE_URL}

Also, be sure to enter the 200k Bracket Contest hosted by BetOnline:
${AFFILIATE_URL}

Hurry up and good luck!`;

  return { subject: SUBJECT, html, text };
}

export async function sendOne(env, to){
  const { subject, html, text } = buildEmail();
  return await sendEmail(env, to, subject, html, text);
}