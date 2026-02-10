import { json, setCookie, pbkdf2Hash, randomB64, ensureUserSchema, getIp, rateLimit } from "./_util.js";

export async function onRequestPost({ request, env }){
  try{
    const ip = getIp(request);

    if(!env || !env.DB) return json({ok:false, error:"MISSING_DB", message:"Server missing D1 binding 'DB'. Add it in Cloudflare Pages → Settings → Functions → Bindings."}, 500);
    if(!env || !env.SESSIONS) return json({ok:false, error:"MISSING_SESSIONS", message:"Server missing KV binding 'SESSIONS'. Add it in Cloudflare Pages → Settings → Functions → Bindings."}, 500);

    const body = await request.json();
    await ensureUserSchema(env);
    const email = String(body.email||"").trim().toLowerCase();
    const password = String(body.password||"");

    // Rate limit AFTER parsing email so households don't collide as easily.
    const rlIp = await rateLimit(env, "login:ip:"+ip, 300, 600);
    if(!rlIp.ok) return json({ok:false, error:"RATE_LIMIT", message:"Too many attempts. Try again soon."}, 429, { "retry-after": String(rlIp.retryAfter) });

    const rl = await rateLimit(env, "login:"+ip+":"+email, 80, 600);
    if(!rl.ok) return json({ok:false, error:"RATE_LIMIT", message:"Too many attempts. Try again soon."}, 429, { "retry-after": String(rl.retryAfter) });

    const row = await env.DB.prepare("SELECT id,email,pass_salt,pass_hash FROM users WHERE email=?").bind(email).first();
    if(!row) return json({ok:false, error:"INVALID_CREDENTIALS", message:"Invalid email or password."}, 401);

    const calc = await pbkdf2Hash(password, row.pass_salt);
    if(calc !== row.pass_hash) return json({ok:false, error:"INVALID_CREDENTIALS", message:"Invalid email or password."}, 401);

    const token = randomB64(24);
    await env.SESSIONS.put("sess:"+token, String(row.id), { expirationTtl: 60*60*24*14 }); // 14 days
    const cookie = setCookie("bb_sess", token, { maxAge: 60*60*24*14 });

    return json({ok:true, user:{id:row.id, email:row.email}}, 200, { "Set-Cookie": cookie });
  }catch(e){
    return json({ok:false, error:"LOGIN_FAILED", message:"Login failed."}, 500);
  }
}
