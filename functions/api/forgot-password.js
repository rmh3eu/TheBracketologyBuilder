import { json, ensureUserSchema, ensurePasswordResetSchema, randomB64, sha256Hex, sendResendEmail, getSiteDomain, getIp, rateLimit } from "./_util.js";

export async function onRequestPost({ request, env }){
  try{
    const ip = getIp(request);

    if(!env || !env.DB) return json({ok:false, error:"MISSING_DB"}, 500);

    const body = await request.json().catch(()=>({}));
    const email = String(body.email||"").trim().toLowerCase();

    // Coarse rate limit per IP to avoid abuse
    const rlIp = await rateLimit(env, "pwreset:ip:"+ip, 30, 600);
    if(!rlIp.ok) return json({ok:false, error:"RATE_LIMIT", message:"Too many requests. Try again soon."}, 429, {"retry-after": String(rlIp.retryAfter)});

    // Always return OK to avoid account enumeration.
    if(!email || !email.includes('@')) return json({ok:true});

    await ensureUserSchema(env);
    await ensurePasswordResetSchema(env);

    const user = await env.DB.prepare("SELECT id,email FROM users WHERE email=?").bind(email).first();
    if(!user) return json({ok:true});

    // Create token (one-time) valid for 60 minutes
    const token = randomB64(32);
    const tokenHash = await sha256Hex(token);
    const now = new Date();
    const createdAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + 60*60*1000).toISOString();

    const ua = request.headers.get('user-agent') || null;

    await env.DB.prepare(
      "INSERT INTO password_resets (user_id, token_hash, created_at, expires_at, used_at, request_ip, request_ua) VALUES (?,?,?,?,?,?,?)"
    ).bind(user.id, tokenHash, createdAt, expiresAt, null, ip, ua).run();

    const domain = getSiteDomain(env);
    const link = `https://${domain}/reset-password.html?token=${encodeURIComponent(token)}`;

    const subject = "Reset your BracketologyBuilder password";
    const html = `
      <div style="font-family:Arial,sans-serif; line-height:1.4">
        <h2 style="margin:0 0 12px 0;">Reset your password</h2>
        <p>We received a request to reset the password for <b>${user.email}</b>.</p>
        <p>Click the button below to set a new password. This link expires in 1 hour.</p>
        <p style="margin:18px 0;">
          <a href="${link}" style="display:inline-block; padding:12px 16px; background:#1d4ed8; color:#fff; text-decoration:none; border-radius:8px;">Reset password</a>
        </p>
        <p style="font-size:12px; color:#555;">If you didn’t request this, you can ignore this email.</p>
      </div>
    `;
    const text = `Reset your BracketologyBuilder password\n\nOpen this link to set a new password (expires in 1 hour):\n${link}\n\nIf you didn’t request this, you can ignore this email.`;

    // Best effort email send
    try{
      await sendResendEmail(env, user.email, subject, html, text);
    }catch(e){
      // Do not reveal email failures to user; still return ok
    }

    return json({ok:true});
  }catch(e){
    // Still respond ok to avoid leaking internal details
    return json({ok:true});
  }
}
