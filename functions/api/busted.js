import { json, requireUser, isAdmin } from './_util.js';

// Stores screenshot submissions for the "Worst Brackets" page.
// - Public GET: returns only approved submissions (no PII)
// - Auth POST: create a pending submission for review
// - Admin PUT: approve/deny a submission

async function ensureBustedTable(env){
  // Keep schema lightweight; screenshots are stored as data URLs (base64) in TEXT.
  // Limit file size on the client to avoid blowing up D1.
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS busted_submissions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      source TEXT,
      title TEXT,
      image_data TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT,
      reviewed_at TEXT,
      reviewed_by TEXT
    )
  `).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_busted_status_created ON busted_submissions(status, created_at)`).run();
}

function uid(){
  return crypto.randomUUID();
}

export async function onRequestGet({ request, env }){
  await ensureBustedTable(env);
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'approved';

  if(status !== 'approved'){
    const admin = await isAdmin({ request, env });
    if(!admin) return json({ ok:false, error:'Forbidden' }, 403);
    const rows = await env.DB.prepare(
      `SELECT id, source, title, image_data, created_at, status FROM busted_submissions WHERE status=? ORDER BY created_at DESC LIMIT 100`
    ).bind(status).all();
    return json({ ok:true, items: rows.results || [] });
  }

  const rows = await env.DB.prepare(
    `SELECT id, source, title, image_data, created_at FROM busted_submissions WHERE status='approved' ORDER BY created_at DESC LIMIT 50`
  ).all();
  return json({ ok: true, items: rows.results || [] });
}

export async function onRequestPost({ request, env }){
  await ensureBustedTable(env);
  const user = await requireUser({ request, env });
  const body = await request.json().catch(()=> ({}));
  const source = String(body.source || '').slice(0,80);
  const title = String(body.title || '').slice(0,120);
  const image_data = String(body.image_data || '');

  if(!image_data || !image_data.startsWith('data:image/')){
    return json({ ok:false, error:'Please upload an image.' }, 400);
  }
  // Soft size guard (dataURL length roughly tracks bytes)
  if(image_data.length > 2_800_000){
    return json({ ok:false, error:'Image too large. Please use a smaller screenshot (max ~2MB).' }, 400);
  }

  const id = uid();
  const created_at = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO busted_submissions (id, user_id, source, title, image_data, status, created_at) VALUES (?,?,?,?,?,'pending',?)`
  ).bind(id, user.id, source, title, image_data, created_at).run();

  return json({ ok:true, id });
}

export async function onRequestPut({ request, env }){
  await ensureBustedTable(env);
  const admin = await isAdmin({ request, env });
  if(!admin){
    return json({ ok:false, error:'Forbidden' }, 403);
  }

  const body = await request.json().catch(()=> ({}));
  const id = String(body.id || '');
  const action = String(body.action || '');
  if(!id || !['approve','deny'].includes(action)){
    return json({ ok:false, error:'Bad request' }, 400);
  }
  const status = action === 'approve' ? 'approved' : 'denied';
  const reviewed_at = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE busted_submissions SET status=?, reviewed_at=?, reviewed_by=? WHERE id=?`
  ).bind(status, reviewed_at, admin.email, id).run();

  return json({ ok:true });
}
