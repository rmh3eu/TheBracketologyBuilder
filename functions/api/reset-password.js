import { json, pbkdf2Hash, ensureUserSchema, ensurePasswordResetSchema, sha256Hex, getIp, rateLimit } from "./_util.js";

export async function onRequestPost({ request, env }){
  try{
    const ip = getIp(request);
    if(!env || !env.DB) return json({ok:false, error:"MISSING_DB"}, 500);

    const body = await request.json().catch(()=>({}));
    const token = String(body.token||"").trim();
    const password = String(body.password||"");

    const rlIp = await rateLimit(env, "pwreset:confirm:ip:"+ip, 50, 600);
    if(!rlIp.ok) return json({ok:false, error:"RATE_LIMIT", message:"Too many attempts. Try again soon."}, 429, {"retry-after": String(rlIp.retryAfter)});

    if(!token) return json({ok:false, error:"MISSING_TOKEN", message:"Missing reset token."}, 400);
    if(password.length < 8) return json({ok:false, error:"WEAK_PASSWORD", message:"Password must be at least 8 characters."}, 400);

    await ensureUserSchema(env);
    await ensurePasswordResetSchema(env);

    const tokenHash = await sha256Hex(token);
    const row = await env.DB.prepare(
      "SELECT id,user_id,expires_at,used_at FROM password_resets WHERE token_hash=? ORDER BY id DESC LIMIT 1"
    ).bind(tokenHash).first();

    if(!row) return json({ok:false, error:"INVALID_TOKEN", message:"That reset link is invalid or expired."}, 400);
    if(row.used_at) return json({ok:false, error:"TOKEN_USED", message:"That reset link has already been used."}, 400);
    const exp = Date.parse(row.expires_at);
    if(Number.isNaN(exp) || Date.now() > exp) return json({ok:false, error:"EXPIRED_TOKEN", message:"That reset link is expired. Request a new one."}, 400);

    // Update user password
    const salt = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
    const hash = await pbkdf2Hash(password, salt);
    await env.DB.prepare("UPDATE users SET pass_salt=?, pass_hash=? WHERE id=?").bind(salt, hash, row.user_id).run();

    // Mark token used
    const nowIso = new Date().toISOString();
    await env.DB.prepare("UPDATE password_resets SET used_at=? WHERE id=?").bind(nowIso, row.id).run();

    return json({ok:true});
  }catch(e){
    return json({ok:false, error:"RESET_FAILED", message:"Could not reset password."}, 500);
  }
}
