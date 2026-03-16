export async function onRequest({ request }) {
  const targetUrl = "https://bracketologybuilder.com/worst-challenge";
  const shareUrl = "https://bracketologybuilder.com/worst-bracket";
  const url = new URL(request.url);
  const ogImage = `${url.origin}/images/worst-bracket-preview.png`;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>😈 Enter Our Worst Bracket Challenge</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Try to build the worst bracket possible on BracketologyBuilder.">
  <meta property="og:title" content="😈 Enter Our Worst Bracket Challenge">
  <meta property="og:description" content="Try to create the worst bracket possible.">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${shareUrl}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="BracketologyBuilder">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="😈 Enter Our Worst Bracket Challenge">
  <meta name="twitter:description" content="Try to create the worst bracket possible.">
  <meta name="twitter:image" content="${ogImage}">
  <style>
    :root{--bg1:#09142f;--bg2:#0f2c68;--gold:#ffcd4a;--blue:#5fc0ff;--red:#d62828}
    *{box-sizing:border-box} body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:Arial,Helvetica,sans-serif;color:#fff;background:
    radial-gradient(circle at top right, rgba(95,192,255,.18), transparent 28%),
    radial-gradient(circle at bottom left, rgba(255,205,74,.14), transparent 30%),
    linear-gradient(135deg,var(--bg1),var(--bg2));padding:24px}
    .card{width:min(760px,100%);border-radius:24px;padding:28px;position:relative;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(8px);box-shadow:0 20px 60px rgba(0,0,0,.35);overflow:hidden}
    .eyebrow{color:var(--blue);font-weight:800;letter-spacing:.06em;font-size:14px}.headline{margin:10px 0 8px;font-size:clamp(26px,5.5vw,50px);line-height:1.02;font-weight:800}.accent{color:var(--gold)}
    p{font-size:18px;line-height:1.5;margin:0 0 22px;color:#ebf3ff;max-width:520px}
    .actions{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
    .btn{display:inline-block;padding:16px 22px;border-radius:14px;font-weight:800;text-decoration:none;color:#fff;background:var(--red);box-shadow:0 10px 28px rgba(214,40,40,.35);border:none;cursor:pointer;font-size:18px}
    .btn.secondary{background:#2048a5}
    .sub{font-size:14px;color:#cfe4ff;width:100%;max-width:620px}
    .ball{position:absolute;right:-10px;top:-10px;width:150px;height:150px;border-radius:50%;background:#eb7120;box-shadow:inset 0 0 0 6px rgba(255,205,74,.35)}
    .ball:before,.ball:after{content:"";position:absolute;inset:18px;border:4px solid #5e2b09;border-radius:50%}
    .ball:before{clip-path: inset(0 50% 0 0)} .ball:after{clip-path: inset(0 0 0 50%)}
    .linev,.lineh{position:absolute;background:#5e2b09}.linev{left:50%;top:10px;width:4px;height:130px;transform:translateX(-50%)} .lineh{left:16px;right:16px;top:50%;height:4px;transform:translateY(-50%)}
  </style>
</head>
<body>
  <div class="card">
    <div class="ball"><div class="linev"></div><div class="lineh"></div></div>
    <div class="eyebrow">BRACKETOLOGYBUILDER.COM</div>
    <div class="headline">😈 Try to Build the <span class="accent">Worst Bracket</span> Possible</div>
    <p>Try to create the worst bracket possible and enter our Worst Bracket Challenge.</p>
    <div class="actions">
      <a class="btn" href="${targetUrl}">Try the Worst Challenge</a>
      <button class="btn secondary" onclick="copyLink()">Copy Share Link</button>
      <div class="sub">Copy and paste this link to share with friends for more chances to win!</div>
    </div>
  </div>
  <script>
    function copyLink(){
      navigator.clipboard.writeText("${shareUrl}");
      alert("Link copied! Send it to friends.");
    }
  </script>
</body>
</html>`;
  return new Response(html,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"public, max-age=300"}});
}
