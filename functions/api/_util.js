function json(data, status=200, extraHeaders={}){
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders
    }
  });
}

function getCookie(request, name){
  const cookie = request.headers.get("cookie") || "";
  const m = cookie.match(new RegExp("(^|;\\s*)" + name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&') + "=([^;]*)"));
  return m ? decodeURIComponent(m[2]) : null;
}

function setCookie(name, value, opts={}){
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${opts.path || "/"}`);
  if(opts.httpOnly !== false) parts.push("HttpOnly");
  if(opts.secure !== false) parts.push("Secure");
  parts.push(`SameSite=${opts.sameSite || "Lax"}`);
  if(opts.maxAge) parts.push(`Max-Age=${opts.maxAge}`);
  if(opts.expires) parts.push(`Expires=${opts.expires}`);
  return parts.join("; ");
}

async function pbkdf2Hash(password, saltB64){
  const enc = new TextEncoder();
  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password),
    { name: "PBKDF2" },
    false, ["deriveBits"]
  );
  // Cloudflare Pages/Workers caps PBKDF2 iterations (errors when > 100000).
  // Keep this <= 100000 and keep it consistent across register/login.
  const bits = await crypto.subtle.deriveBits(
    { name:"PBKDF2", salt, iterations: 100000, hash:"SHA-256" },
    keyMaterial,
    256
  );
  const hash = btoa(String.fromCharCode(...new Uint8Array(bits)));
  return hash;
}

function randomB64(bytes=24){
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr)).replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_');
}

// Back-compat helpers (older versions of api/*.js may import these)
export function createSalt(bytes = 16) {
  return randomB64(bytes);
}

// Creates a signed-in session in KV and returns a Set-Cookie value.
export async function createSession(env, userId, request = null, opts = {}) {
  if (!env || !env.SESSIONS) throw new Error("SESSIONS KV binding missing");
  if (!userId && userId !== 0) throw new Error("userId required");

  const maxAgeDays = opts.maxAgeDays ?? 30;
  const ttl = Math.max(60, Math.floor(maxAgeDays * 86400));
  const sessionId = randomB64(24);

  const nowIso = new Date().toISOString();
  const ip = request ? getIp(request) : null;
  const ua = request ? (request.headers.get("user-agent") || "") : "";
  const session = { userId, createdAt: nowIso, ip, ua };

  await env.SESSIONS.put(sessionId, JSON.stringify(session), { expirationTtl: ttl });

  const cookieName = env.SESSION_COOKIE_NAME || "bb_session";
  const isLocal = request ? /^http:\/\/(localhost|127\.0\.0\.1)/.test(request.url) : false;
  const secureAttr = isLocal ? "" : "; Secure";
  const cookie = `${cookieName}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ttl}${secureAttr}`;

  return { sessionId, cookieName, cookie };
}


// Accept both call styles:
//   requireUser(request, env)
//   requireUser({ request, env })
async function requireUser(arg1, arg2){
  let request, env;
  if(arg1 && typeof arg1 === 'object' && ('request' in arg1) && ('env' in arg1)){
    ({ request, env } = arg1);
  }else{
    request = arg1;
    env = arg2;
  }

  // If bindings aren't configured yet, treat as signed-out.
  if(!env || !env.SESSIONS || !env.DB) return null;
  const token = getCookie(request, "bb_sess");
  if(!token) return null;
  const userId = await env.SESSIONS.get("sess:"+token);
  if(!userId) return null;
  // Fetch common user fields used across APIs (opt-ins, phone, etc.)
  const row = await env.DB.prepare(
    "SELECT id,email,phone,optin_email,optin_live,optin_upcoming,optin_sms,optin_ads,consent_ts,consent_ip FROM users WHERE id=?"
  ).bind(userId).first();
  return row || null;
}

function isAdmin(user, env){
  const adminEmail = env.ADMIN_EMAIL || "";
  return !!(user && adminEmail && user.email && user.email.toLowerCase() === adminEmail.toLowerCase());
}

async function isLocked(env){
  try{
    const rs = await env.DB.prepare(
      "SELECT key, value_text FROM site_settings WHERE key IN ('lock_enabled','lock_at_iso')"
    ).all();
    const map = Object.fromEntries((rs.results||[]).map(r=>[r.key, r.value_text]));
    if(map.lock_enabled !== 'true') return false;
    const iso = (map.lock_at_iso || "").trim();
    if(!iso){
      // lock enabled with no time means lock immediately
      return true;
    }
    const lockTs = Date.parse(iso);
    if(Number.isNaN(lockTs)) return false;
    return Date.now() >= lockTs;
  }catch(e){
    return false;
  }
}





async function ensureUserSchema(env){
  // Create users table and ensure required columns exist.
  // Safe to call repeatedly.
  if(!env || !env.DB) throw new Error("Missing D1 binding 'DB'.");

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    pass_salt TEXT NOT NULL,
    pass_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    phone TEXT,
    optin_email INTEGER DEFAULT 0,
    optin_live INTEGER DEFAULT 0,
    optin_upcoming INTEGER DEFAULT 0,
    optin_sms INTEGER DEFAULT 0,
    optin_ads INTEGER DEFAULT 0,
    consent_ts TEXT,
    consent_ip TEXT
  );`).run();

  // If the table existed from older schema, add missing columns.
  const info = await env.DB.prepare("PRAGMA table_info(users)").all().catch(()=>({results:[]}));
  const cols = (info.results||[]).map(r=>r.name);

  const add = async (sql) => { try{ await env.DB.prepare(sql).run(); }catch(e){} };

  if(!cols.includes("phone")) await add("ALTER TABLE users ADD COLUMN phone TEXT");
  if(!cols.includes("optin_email")) await add("ALTER TABLE users ADD COLUMN optin_email INTEGER DEFAULT 0");
  if(!cols.includes("optin_live")) await add("ALTER TABLE users ADD COLUMN optin_live INTEGER DEFAULT 0");
  if(!cols.includes("optin_upcoming")) await add("ALTER TABLE users ADD COLUMN optin_upcoming INTEGER DEFAULT 0");
  if(!cols.includes("optin_sms")) await add("ALTER TABLE users ADD COLUMN optin_sms INTEGER DEFAULT 0");
  if(!cols.includes("optin_ads")) await add("ALTER TABLE users ADD COLUMN optin_ads INTEGER DEFAULT 0");
  if(!cols.includes("consent_ts")) await add("ALTER TABLE users ADD COLUMN consent_ts TEXT");
  if(!cols.includes("consent_ip")) await add("ALTER TABLE users ADD COLUMN consent_ip TEXT");
}


async function ensureGamesSchema(env){
  const info = await env.DB.prepare("PRAGMA table_info(games)").all().catch(()=>({results:[]}));
  const cols = (info.results||[]).map(r=>r.name);
  if(cols.length && !cols.includes("score_total")){
    await env.DB.prepare("ALTER TABLE games ADD COLUMN score_total INTEGER").run();
  }
}



async function ensureMilestones(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS milestones (
    key TEXT PRIMARY KEY,
    fired_at TEXT NOT NULL
  )`).run();
}

function getSiteDomain(env){
  return (env.SITE_DOMAIN || "bracketologybuilder.com").replace(/^https?:\/\//,"").replace(/\/+$/,"");
}

function getFromEmail(env){
  if(env.FROM_EMAIL) return env.FROM_EMAIL;
  return `noreply@${getSiteDomain(env)}`;
}

async function sendResendEmail(env, to, subject, html, text){
  const apiKey = env.RESEND_API_KEY;
  if(!apiKey) throw new Error("Missing RESEND_API_KEY");
  const from = `${env.SITE_NAME || "Bracketology Builder"} <${getFromEmail(env)}>`;
  const payload = {
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html: html || undefined,
    text: text || undefined
  };
  const res = await fetch("https://api.resend.com/emails",{
    method:"POST",
    headers:{
      "content-type":"application/json",
      "authorization":`Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });
  if(!res.ok){
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
  return await res.json();
}


function getIp(request){
  const cf = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '';
  return String(cf).split(',')[0].trim() || 'unknown';
}

async function rateLimit(env, key, limit, windowSec){
  // Minimal KV-backed rate limiter. Uses env.SESSIONS if available.
  // Stores {c,countReset} as JSON.
  if(!env || !env.SESSIONS) return { ok:true };
  const k = 'rl:' + key;
  const now = Date.now();
  let state = null;
  try{ state = JSON.parse(await env.SESSIONS.get(k) || 'null'); }catch{ state = null; }
  if(!state || !state.reset || now > state.reset){
    state = { c:0, reset: now + (windowSec*1000) };
  }
  state.c += 1;
  // TTL slightly longer than window to ensure cleanup
  await env.SESSIONS.put(k, JSON.stringify(state), { expirationTtl: windowSec + 30 });
  if(state.c > limit){
    const retry = Math.max(1, Math.ceil((state.reset - now)/1000));
    return { ok:false, retryAfter: retry };
  }
  return { ok:true };
}

// --- Email helpers (shared by lead capture + admin sends) ---
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

export function normalizeEmail(email) {
  if (typeof email !== "string") return "";
  return email.trim().toLowerCase();
}

export function isValidEmail(email) {
  const e = normalizeEmail(email);
  if (!e) return false;
  // basic + requires a dot-TLD of length >= 2 (prevents things like "gmail.c")
  return EMAIL_REGEX.test(e);
}

function uid(){
  return crypto.randomUUID();
}


// Wrapper used by Pages Functions routes
async function sendEmail(env, to, subject, html, text){
  // Currently uses Resend (RESEND_API_KEY). If you later add another provider, switch here.
  return await sendResendEmail(env, to, subject, html, text);
}

// NOTE: getIp, rateLimit, normalizeEmail, and isValidEmail are already exported
// via `export function ...` declarations above. Re-exporting them here causes
// Cloudflare Pages Functions builds to fail with "Multiple exports with the same name".
export { json, getCookie, setCookie, pbkdf2Hash, randomB64, requireUser, isAdmin, isLocked, ensureUserSchema, ensureGamesSchema, ensureMilestones, sendEmail, sendResendEmail, getSiteDomain, uid };