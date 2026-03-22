
import { sendEmail } from './_util.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const RECIPIENTS = [
"dxiniix@gmail.com",
"cjpotter@stu.neperville203.org",
"jmac0621@yahoo.com",
"jacksoncookie23@gmail.com",
"hufmane49@gmail.com",
"taywest41@gmail.com",
"tenoble306@icloud.com",
"jack_judy30@gmail.com",
"chiefsking84@gmail.com",
"kd7daly@yahoo.com",
"teoramon07@gmail.com",
"lenquinrayan@yahoo.com",
"sr1968643@gmail.com",
"matthewkirk1@gmail.com",
"tucker.whitmire@icloud.com",
"vincent1kul@gmail.com",
"trent72007@gmail.com",
"bigyetter11@gmail.com",
"bruce.brayden26@markesan.k12.wi.us",
"robby@bracketologybuilder.com",
"iamkanji1@gmail.com",
"rowdyharvey@gmail.com",
"goaltending30@gmail.com",
"rileywhite0621@gmail.com",
"101010batz@gmail.com",
"cameron2840@gmail.com",
"tauber10@gmail.com",
"lerpstein07@icloud.com",
"colind.11@icloud.com",
"yoksaloss8@gmail.com",
"bigfareboob@gmail.com",
"major8280@aol.com",
"rmh3eu@virginia.edu",
"kla016@bucknell.edu"
];

export async function onRequest({ env }) {

const subject = "🏀 The Official Bracket Is Out!";

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
style="display:inline-block;background:#1e73be;color:#fff;padding:14px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">
Create Your Bracket
</a>
</div>

<p style="text-align:center;font-weight:bold;">Also check out the $200,000 Bracket Challenge:</p>

<div style="text-align:center;margin:25px 0;">
<a href="https://record.betonlineaffiliates.ag/_xZrmHTbHGhIoAmwrkE6KlGNd7ZgqdRLk/1/"
style="display:inline-block;background:#d62828;color:#fff;padding:14px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">
Enter the $200K Contest
</a>
</div>
</div>
`;

const text = `
The Official Bracket Is Out!

Fill out your brackets now!

Create your bracket:
https://bracketologybuilder.com

Enter the $200K contest:
https://record.betonlineaffiliates.ag/_xZrmHTbHGhIoAmwrkE6KlGNd7ZgqdRLk/1/
`;

let sent = 0;
let failed = 0;
const errors = [];

for (const to of RECIPIENTS) {

try {

await sendEmail(env, to, subject, html, text);
sent++;

} catch(e){

failed++;
errors.push(to + " : " + String(e?.message || e));

}

await sleep(800);

}

return new Response(

[
`Recipients: ${RECIPIENTS.length}`,
`Sent: ${sent}`,
`Failed: ${failed}`,
"",
...errors

].join("\n"),

{headers:{'content-type':'text/plain'}}

);

}
