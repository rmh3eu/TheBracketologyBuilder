import { json, requireUser, isAdmin, uid } from "./_util.js";

// Image / screenshot submissions for Featured Brackets:
// kind: 'best' | 'worst'
// source: 'builder' | 'other'
// Stored as base64 data URL in KV to avoid needing R2.

async function ensureTables(env){
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS featured_submissions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      email TEXT,
      kind TEXT NOT NULL,
      source TEXT NOT NULL,
      kv_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function assertKind(kind){
  return kind === 'best' || kind === 'worst';
}

function assertSource(source){
  return source === 'builder' || source === 'other';
}

export async function onRequestGet({ request, env }){
  await ensureTables(env);
  const url = new URL(request.url);
  const kind = url.searchParams.get('kind') || 'worst';
  const status = url.searchParams.get('status') || 'approved';
  if(!assertKind(kind)) return json({ok:false, error:'Invalid kind'}, 400);

  // Only admin can view pending/rejected
  let viewer = null;
  try{ viewer = await requireUser({request, env}); }catch{}
  const viewerIsAdmin = viewer ? isAdmin(viewer, env) : false;
  if(status !== 'approved' && !viewerIsAdmin) return json({ok:false, error:'Unauthorized'}, 401);

  const rows = await env.DB.prepare(
    `SELECT id, user_id, email, kind, source, kv_key, status, created_at
     FROM featured_submissions
     WHERE kind=? AND status=?
     ORDER BY datetime(created_at) DESC
     LIMIT 200`
  ).bind(kind, status).all();

  const out = [];
  for(const r of (rows.results||[])){
    const dataUrl = await env.SESSIONS.get(r.kv_key);
    out.push({
      id: r.id,
      kind: r.kind,
      source: r.source,
      email: r.email || null,
      status: r.status,
      created_at: r.created_at,
      dataUrl: dataUrl || null,
    });
  }
  return json({ok:true, submissions: out});
}

export async function onRequestPost({ request, env }){
  await ensureTables(env);
  const body = await request.json().catch(()=>null);
  if(!body) return json({ok:false, error:'Invalid JSON'}, 400);

  const action = body.action || 'create';
  const viewer = await requireUser({request, env});
  const viewerIsAdmin = viewer ? isAdmin(viewer, env) : false;

  if(action === 'create'){
    const kind = body.kind || 'worst';
    const source = body.source || 'other';
    const email = (body.email || (viewer?.email)||'').trim().slice(0, 200);
    const dataUrl = body.dataUrl || '';
    if(!assertKind(kind)) return json({ok:false, error:'Invalid kind'}, 400);
    if(!assertSource(source)) return json({ok:false, error:'Invalid source'}, 400);
    if(!dataUrl.startsWith('data:image/')) return json({ok:false, error:'Please upload an image'}, 400);

    // Basic size guard: ~5MB base64 string
    if(dataUrl.length > 7_000_000) return json({ok:false, error:'Image too large (max ~5MB). Please upload a smaller screenshot.'}, 413);

    const id = uid();
    const kv_key = `feat:${id}`;
    await env.SESSIONS.put(kv_key, dataUrl);

    await env.DB.prepare(
      `INSERT INTO featured_submissions (id, user_id, email, kind, source, kv_key, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`
    ).bind(id, viewer?.id || null, email || null, kind, source, kv_key).run();

    return json({ok:true, id});
  }

  if(!viewerIsAdmin) return json({ok:false, error:'Unauthorized'}, 401);

  if(action === 'review'){
    const id = body.id;
    const decision = body.decision; // 'approve' | 'deny'
    if(!id) return json({ok:false, error:'Missing id'}, 400);
    if(decision !== 'approve' && decision !== 'deny') return json({ok:false, error:'Invalid decision'}, 400);
    const status = decision === 'approve' ? 'approved' : 'denied';
    await env.DB.prepare(`UPDATE featured_submissions SET status=? WHERE id=?`).bind(status, id).run();
    return json({ok:true});
  }

  if(action === 'delete'){
    const id = body.id;
    if(!id) return json({ok:false, error:'Missing id'}, 400);
    const row = await env.DB.prepare(`SELECT kv_key FROM featured_submissions WHERE id=?`).bind(id).first();
    if(row?.kv_key) await env.SESSIONS.delete(row.kv_key);
    await env.DB.prepare(`DELETE FROM featured_submissions WHERE id=?`).bind(id).run();
    return json({ok:true});
  }

  return json({ok:false, error:'Unknown action'}, 400);
}
