export async function onRequest({ request }) {
  const affiliateUrl = "https://record.betonlineaffiliates.ag/_xZrmHTbHGhIoAmwrkE6KlGNd7ZgqdRLk/1/";
  const url = new URL(request.url);
  const ogImage = `${url.origin}/images/contest-200k-preview.png`;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>🏀 Get $200 in Bonus with Sign Up</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Get $200 in Bonus with Sign Up through BracketologyBuilder.">
  <meta property="og:title" content="🏀 Get $200 in Bonus with Sign Up">
  <meta property="og:description" content="Tap to enter through BracketologyBuilder.">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${url.origin}/200k">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="BracketologyBuilder">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="🏀 Get $200 in Bonus with Sign Up">
  <meta name="twitter:description" content="Tap to enter through BracketologyBuilder.">
  <meta name="twitter:image" content="${ogImage}">
  <meta http-equiv="refresh" content="1; url=${affiliateUrl}">
  <style>
    :root{
      --bg1:#09142f; --bg2:#113173; --gold:#ffcd4a; --blue:#6fb9ff; --red:#d92d2d;
    }
    *{box-sizing:border-box}
    html,body{height:100%}
    body{
      margin:0;
      min-height:100vh;
      font-family:Arial,Helvetica,sans-serif;
      color:#fff;
      background:
        radial-gradient(circle at top right, rgba(95,192,255,.12), transparent 30%),
        radial-gradient(circle at bottom left, rgba(255,205,74,.10), transparent 30%),
        linear-gradient(135deg,var(--bg1),var(--bg2));
      padding:20px;
    }
    .wrap{
      min-height:calc(100vh - 40px);
      display:flex;
      align-items:center;
      justify-content:center;
    }
    .card{
      width:min(820px,100%);
      border-radius:28px;
      padding:28px;
      background:rgba(255,255,255,.06);
      border:1px solid rgba(255,255,255,.14);
      box-shadow:0 18px 50px rgba(0,0,0,.35);
      backdrop-filter: blur(8px);
    }
    .eyebrow{color:var(--blue); font-weight:800; letter-spacing:.06em; font-size:15px; margin-bottom:10px}
    h1{
      margin:0 0 14px;
      font-size:clamp(34px,7vw,58px);
      line-height:1.02;
      max-width:680px;
    }
    .gold{color:var(--gold)}
    p{
      font-size:clamp(18px,3.6vw,24px);
      line-height:1.45;
      margin:0 0 22px;
      color:#ecf3ff;
      max-width:650px;
    }
    .actions{
      display:flex;
      flex-wrap:wrap;
      gap:14px;
      align-items:center;
      margin-top:10px;
    }
    .btn{
      display:inline-block;
      padding:16px 24px;
      border-radius:16px;
      font-weight:800;
      text-decoration:none;
      color:#fff;
      background:var(--red);
      box-shadow:0 10px 28px rgba(217,45,45,.35);
      font-size:20px;
    }
    .sub{
      width:100%;
      color:#d7e7ff;
      font-size:14px;
      margin-top:4px;
    }
    @media (max-width: 700px){
      body{padding:0}
      .wrap{min-height:100vh}
      .card{
        width:100%;
        min-height:100vh;
        border-radius:0;
        display:flex;
        flex-direction:column;
        justify-content:center;
        padding:28px 24px;
      }
      h1{max-width:none}
      p{max-width:none}
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="eyebrow">BRACKETOLOGYBUILDER.COM</div>
      <h1>🏀 Enter the <span class="gold">$200,000</span><br>March Madness Bracket Contest</h1>
      <p>Tap below to enter. You’ll be redirected automatically in a moment.</p>
      <div class="actions">
        <a class="btn" href="${affiliateUrl}" rel="noopener noreferrer">Enter the Contest</a>
        <div class="sub">Share this link with friends: bracketologybuilder.com/200k</div>
      </div>
    </div>
  </div>

<div style="position:absolute;bottom:10px;width:100%;text-align:center;font-size:12px;color:#9fb3d9;">
21+. Gambling problem? Call 1-800-GAMBLER. Not available in all states. Terms apply.
</div>
</body>

</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300"
    }
  });
}
