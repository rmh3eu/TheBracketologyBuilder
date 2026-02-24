import { json, requireUser, isAdmin, sendEmail, getSiteDomain } from "./_util.js";


function isCompleteBracketData(data){
  try{
    const picks = data && data.picks ? data.picks : null;
    if(!picks) return false;
    const regionKeys = ['REGION_SOUTH','REGION_WEST','REGION_EAST','REGION_MIDWEST'];
    for(const rKey of regionKeys){
      for(let g=0; g<8; g++){ if(!picks[`${rKey}__R0__G${g}__winner`]) return false; }
      for(let g=0; g<4; g++){ if(!picks[`${rKey}__R1__G${g}__winner`]) return false; }
      for(let g=0; g<2; g++){ if(!picks[`${rKey}__R2__G${g}__winner`]) return false; }
      if(!picks[`${rKey}__R3__G0__winner`]) return false;
    }
    if(!picks['FF__G0__winner']) return false;
    if(!picks['FF__G1__winner']) return false;
    const champ = picks['FINAL__winner'] || picks['CHAMPION'];
    if(!champ) return false;
    return true;
  }catch(e){
    return false;
  }
}

export async function onRequestPost({ request, env }){
  // submit a feature request
  const user = await requireUser({request, env});
  if(!user) return json({ok:false, error:"Not logged in."}, 401);

  const body = await request.json();
  const bracketId = String(body.bracket_id||"");
  const caption = String(body.caption||"").slice(0,200);
  if(!bracketId) return json({ok:false, error:"Missing bracket id."}, 400);

  const row = await env.DB.prepare("SELECT id,user_id,data_json FROM brackets WHERE id=?").bind(bracketId).first();
  if(!row) return json({ok:false, error:"Bracket not found."}, 404);
  if(row.user_id !== user.id) return json({ok:false, error:"Not authorized."}, 403);

  // Only allow featured submission for fully completed brackets.
  try{
    const data = JSON.parse(row.data_json || '{}');
}catch(e){
    return json({ ok:false, error:"Unable to submit bracket." }, 400);
}

  const existing = await env.DB.prepare(
    "SELECT id, status FROM feature_requests WHERE bracket_id=? AND user_id=? ORDER BY created_at DESC LIMIT 1"
  ).bind(bracketId, user.id).first();
  if(existing){
    return json({ok:true, already:true, status: existing.status});
  }

  const now = new Date().toISOString();
  const approvedAt = (status === 'approved') ? now : null;
  await env.DB.prepare(
    "UPDATE feature_requests SET status=?, approved_at=? WHERE id=?"
  ).bind(status, approvedAt, id).run();

  // Send an email when a bracket is approved (strong moment).
  if(status === 'approved'){
    try{
      const info = await env.DB.prepare(
        `SELECT u.email AS email, b.title AS title
           FROM feature_requests fr
           JOIN users u ON u.id = fr.user_id
           JOIN brackets b ON b.id = fr.bracket_id
          WHERE fr.id = ?
          LIMIT 1`
      ).bind(id).first();

      if(info && info.email){
        const domain = getSiteDomain(env);
        const siteUrl = `https://${domain}`;
        const featuredUrl = `${siteUrl}/featured.html`;
        const subject = "Your bracket was approved for Featured 🎉";
        const safeTitle = (info.title || 'Your bracket').toString();
        const text = `Congratulations — your bracket ("${safeTitle}") was approved and is now eligible to appear on our Featured Brackets page.\n\nView Featured Brackets: ${featuredUrl}\n\nThanks for choosing BracketologyBuilder.com!`;
        const html = `
          <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.4">
            <h2 style="margin:0 0 12px 0">Your bracket was approved 🎉</h2>
            <p style="margin:0 0 12px 0">Congratulations — your bracket <b>${safeTitle.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</b> was approved and is now eligible to appear on our Featured Brackets page.</p>
            <p style="margin:0 0 16px 0"><a href="${featuredUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 14px;border-radius:10px">View Featured Brackets</a></p>
            <p style="margin:0">Thank you for choosing BracketologyBuilder.com!</p>
          </div>
        `;
        await sendEmail(env, info.email, subject, html, text);
      }
    }catch(e){
      // Best-effort only; approval should still succeed.
    }
  }

  return json({ok:true});
}
