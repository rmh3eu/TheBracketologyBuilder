import { json, pbkdf2Hash, ensureUserSchema, getIp, rateLimit } from "./_util.js";

export async function onRequestPost({ request, env }){
  try{
    const ip = getIp(request);

    if(!env || !env.DB) return json({ok:false, error:"MISSING_DB", message:"Server missing D1 binding 'DB'. Add it in Cloudflare Pages → Settings → Functions → Bindings."}, 500);
    if(!env || !env.SESSIONS) return json({ok:false, error:"MISSING_SESSIONS", message:"Server missing KV binding 'SESSIONS'. Add it in Cloudflare Pages → Settings → Functions → Bindings."}, 500);

    const body = await request.json();
    const email = String(body.email||"").trim().toLowerCase();
    const password = String(body.password||"");
    const phoneRaw = String(body.phone||"").trim();
    const phone = phoneRaw ? phoneRaw.replace(/[^0-9+]/g,"") : "";
    const optinLive = !!body.optin_live;
    const optinUpcoming = !!body.optin_upcoming;
    const optinSms = !!body.optin_sms;
    const optinAds = !!body.optin_ads;
    const optinEmail = optinLive || optinUpcoming;

    // Rate limit AFTER parsing email so households don't collide as easily.
    // - Per-IP coarse limit (very high)
    // - Per-IP+email tighter limit
    const rlIp = await rateLimit(env, "register:ip:"+ip, 120, 600);
    if(!rlIp.ok) return json({ok:false, error:"RATE_LIMIT", message:"Too many attempts. Try again soon."}, 429, { "retry-after": String(rlIp.retryAfter) });

    const rl = await rateLimit(env, "register:"+ip+":"+email, 30, 600);
    if(!rl.ok) return json({ok:false, error:"RATE_LIMIT", message:"Too many attempts. Try again soon."}, 429, { "retry-after": String(rl.retryAfter) });

    if(!email || !email.includes("@")) return json({ok:false, error:"INVALID_EMAIL", message:"Enter a valid email."}, 400);
    if(password.length < 8) return json({ok:false, error:"WEAK_PASSWORD", message:"Password must be at least 8 characters."}, 400);
    if(phone && (phone.replace(/\D/g,"").length < 10 || phone.replace(/\D/g,"").length > 15)) return json({ok:false, error:"INVALID_PHONE", message:"Enter a valid phone number."}, 400);

    const salt = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
    const hash = await pbkdf2Hash(password, salt);
    await ensureUserSchema(env);
    const now = new Date().toISOString();

    await env.DB.prepare(
      "INSERT INTO users (email, pass_salt, pass_hash, created_at, phone, optin_email, optin_live, optin_upcoming, optin_sms, optin_ads, consent_ts, consent_ip) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
    ).bind(
      email, salt, hash, now, phone||null,
      optinEmail?1:0,
      optinLive?1:0,
      optinUpcoming?1:0,
      optinSms?1:0,
      optinAds?1:0,
      now, ip
    ).run();

    return json({ok:true});
  }catch(e){
    const msg = String(e && e.message || e);
    if(msg.includes("UNIQUE")) return json({ok:false, error:"EMAIL_EXISTS", message:"That email is already registered."}, 409);
    return json({ok:false, error:"REGISTER_FAILED", message: msg || "Registration failed."}, 500);
  }
}
