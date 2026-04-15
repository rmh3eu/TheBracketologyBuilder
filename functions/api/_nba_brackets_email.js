import { sendEmail } from './_util.js';

export const SUBJECT = 'Make an NBA Bracket Now Before the Playoffs Begin 🏀';
export const SITE_URL = 'https://bracketologybuilder.com';
export const NBA_URL = `${SITE_URL}/nba.html`;
export const GAMES_URL = `${SITE_URL}/bracket-games.html`;

export function buildEmail(){
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f5f7fb;padding:24px;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px 26px;text-align:center;border:1px solid #e5e7eb;">
      <div style="font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#2563eb;">Official NBA Brackets</div>
      <h1 style="margin:14px 0 10px;font-size:30px;line-height:1.15;color:#111827;">Make an NBA Bracket Now Before the Playoffs Begin 🏀</h1>
      <p style="margin:0 0 18px;font-size:17px;line-height:1.6;color:#374151;">The playoffs are almost here.</p>
      <p style="margin:0 0 26px;font-size:17px;line-height:1.6;color:#374151;">Make your NBA bracket now before games tip off.</p>
      <div style="margin:0 0 16px;">
        <a href="${NBA_URL}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:999px;font-weight:800;font-size:16px;">Make an NBA Bracket</a>
      </div>
      <p style="margin:22px 0 14px;font-size:16px;line-height:1.6;color:#374151;">Want more ways to play?</p>
      <div style="margin:0;">
        <a href="${GAMES_URL}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:999px;font-weight:800;font-size:16px;">Play Bracket Games</a>
      </div>
      <p style="margin:26px 0 0;font-size:12px;line-height:1.5;color:#6b7280;">You’re receiving this because you signed up for BracketologyBuilder emails.</p>
    </div>
  </div>`;

  const text = `Make an NBA Bracket Now Before the Playoffs Begin 🏀\n\nThe playoffs are almost here.\n\nMake your NBA bracket now before games tip off.\n\nMake an NBA Bracket:\n${NBA_URL}\n\nWant more ways to play?\n\nPlay Bracket Games:\n${GAMES_URL}`;

  return { subject: SUBJECT, html, text };
}

export async function sendOne(env, to){
  const { subject, html, text } = buildEmail();
  return await sendEmail(env, to, subject, html, text);
}
