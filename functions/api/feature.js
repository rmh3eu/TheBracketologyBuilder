import { json, requireUser, isAdmin, sendEmail, getSiteDomain } from "./_util.js";


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
  // Allow featured submission for any bracket (complete or not)

  const existing = await env.DB.prepare(
    "SELECT id, status FROM feature_requests WHERE bracket_id=? AND user_id=? ORDER BY created_at DESC LIMIT 1"
  ).bind(bracketId, user.id).first();
  if(existing){
    return json({ok:true, already:true, status: existing.status});
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO feature_requests (bracket_id,user_id,caption,status,created_at) VALUES (?,?,?,?,?)" /* ALREADY_SUBMITTED */
  ).bind(bracketId, user.id, caption, "pending", now).run();

  return json({ok:true});
}

export async function onRequestGet({ request, env }){
  // admin list pending/approved
  const user = await requireUser({request, env});
  if(!isAdmin(user, env)) return json({ok:false, error:"Not authorized."}, 403);

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "pending";

  const rs = await env.DB.prepare(
    `SELECT fr.id, fr.bracket_id, fr.caption, fr.status, fr.created_at, u.email as user_email, b.title
     FROM feature_requests fr
     JOIN users u ON u.id = fr.user_id
     JOIN brackets b ON b.id = fr.bracket_id
     WHERE fr.status = ?
     ORDER BY fr.created_at DESC
     LIMIT 100`
  ).bind(status).all();

  return json({ok:true, requests: rs.results || []});
}

export async function onRequestPut({ request, env }){
  // admin approve/reject
  const user = await requireUser({request, env});
  if(!isAdmin(user, env)) return json({ok:false, error:"Not authorized."}, 403);

  const body = await request.json();
  const id = body.id;
  const status = body.status;
  if(!id || !["approved","rejected"].includes(status)) return json({ok:false, error:"Bad request."}, 400);

  const now = new Date().toISOString();
  await env.DB.prepare(
    "UPDATE feature_requests SET status=?, approved_at=? WHERE id=?"
  ).bind(status, now, id).run();

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
