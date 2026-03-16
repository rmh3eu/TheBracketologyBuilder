export async function onRequest({ request }) {
  const affiliateUrl = "https://record.betonlineaffiliates.ag/_xZrmHTbHGhIoAmwrkE6KlGNd7ZgqdRLk/1/";
  const url = new URL(request.url);
  const ogImage = `${url.origin}/images/contest-200k-preview.png`;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>🏀 Enter the $200,000 March Madness Bracket Contest</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Enter the $200,000 March Madness Bracket Contest through BracketologyBuilder.">
  <meta property="og:title" content="🏀 Enter the $200,000 March Madness Bracket Contest">
  <meta property="og:description" content="A fun March Madness contest link from BracketologyBuilder. Tap to enter.">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:url" content="${url.origin}/200k">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="BracketologyBuilder">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="🏀 Enter the $200,000 March Madness Bracket Contest">
  <meta name="twitter:description" content="A fun March Madness contest link from BracketologyBuilder. Tap to enter.">
  <meta name="twitter:image" content="${ogImage}">
  <meta http-equiv="refresh" content="1; url=${affiliateUrl}">
  <style>
    :root{
      --bg1:#09142f; --bg2:#0f2c68; --gold:#ffcd4a; --blue:#5fc0ff; --red:#d62828;
    }
    *{box-sizing:border-box}
    body{
      margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
      font-family:Arial,Helvetica,sans-serif; color:#fff;
      background:
        radial-gradient(circle at top right, rgba(95,192,255,.18), transparent 28%),
        radial-gradient(circle at bottom left, rgba(255,205,74,.14), transparent 30%),
        linear-gradient(135deg,var(--bg1),var(--bg2));
      padding:24px;
    }
    .card{
      width:min(720px,100%); border-radius:24px; padding:28px; position:relative;
      background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.16);
      backdrop-filter: blur(8px); box-shadow:0 20px 60px rgba(0,0,0,.35);
      overflow:hidden;
    }
    .eyebrow{color:var(--blue); font-weight:800; letter-spacing:.06em; font-size:14px}
    h1{margin:12px 0 10px; font-size:clamp(30px,6vw,52px); line-height:1.02}
    .gold{color:var(--gold)}
    p{font-size:18px; line-height:1.55; margin:0 0 22px; color:#ebf3ff}
    .actions{display:flex; flex-wrap:wrap; gap:12px; align-items:center}
    .btn{
      display:inline-block; padding:16px 22px; border-radius:14px; font-weight:800; text-decoration:none;
      color:#fff; background:var(--red); box-shadow:0 10px 28px rgba(214,40,40,.35); border:none; cursor:pointer;
    }
    .btn.secondary{background:#2048a5; box-shadow:0 10px 28px rgba(32,72,165,.35)}
    .sub{font-size:14px; color:#cfe4ff}
    .ball{
      position:absolute; right:-10px; top:-10px; width:150px; height:150px; border-radius:50%;
      background:#eb7120; box-shadow: inset 0 0 0 6px rgba(255,205,74,.35);
      opacity:.95;
    }
    .ball:before,.ball:after{content:""; position:absolute; inset:18px; border:4px solid #5e2b09; border-radius:50%}
    .ball:before{clip-path: inset(0 50% 0 0)}
    .ball:after{clip-path: inset(0 0 0 50%)}
    .linev,.lineh{position:absolute; background:#5e2b09}
    .linev{left:50%; top:10px; width:4px; height:130px; transform:translateX(-50%)}
    .lineh{left:16px; right:16px; top:50%; height:4px; transform:translateY(-50%)}
    .tiny{margin-top:12px; font-size:12px; color:#b7cfff}
  </style>
</head>
<body>
  <div class="card">
    <div class="ball"><div class="linev"></div><div class="lineh"></div></div>
    <div class="eyebrow">BRACKETOLOGYBUILDER.COM</div>
    <h1>🏀 Enter the <span class="gold">$200,000</span><br>March Madness Bracket Contest</h1>
    <p>Tap below to enter. You’ll be redirected automatically in a moment.</p>
    <div class="actions">
      <a class="btn" href="${affiliateUrl}" rel="noopener noreferrer">Enter the Contest</a>
      <div class="sub">Fun link for DMs, texts, and social shares.</div>
    </div>
    <div class="tiny">If you are not redirected automatically, use the button above.</div>
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
