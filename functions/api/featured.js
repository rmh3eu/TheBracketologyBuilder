import { json } from "./_util.js";

async function hasColumn(env, table, col){
  try{
    const info = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
    return (info?.results || []).some(r => String(r.name).toLowerCase() === String(col).toLowerCase());
  }catch(_){ return false; }
}

async function safeRun(p){ try{ await p; }catch(_){ } }

async function ensureFeatureRequests(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS feature_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bracket_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      caption TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      approved_at TEXT,
      denied_at TEXT
    )
  `).run();

  await env.DB.prepare(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_feature_requests_bracket_id
    ON feature_requests(bracket_id)
  `).run();

  const hasIsFeatured = await hasColumn(env, 'brackets', 'is_featured');
  const hasApprovedAt = await hasColumn(env, 'brackets', 'approved_at');
  const hasSubmittedAt = await hasColumn(env, 'brackets', 'submitted_at');

  if (hasIsFeatured || hasApprovedAt) {
    const createdExpr = hasSubmittedAt ? "COALESCE(b.submitted_at, b.updated_at, b.created_at)" : "COALESCE(b.updated_at, b.created_at)";
    const approvedExpr = hasApprovedAt ? "COALESCE(b.approved_at, b.updated_at, b.created_at)" : "COALESCE(b.updated_at, b.created_at)";

    await safeRun(env.DB.prepare(`
      INSERT OR IGNORE INTO feature_requests (bracket_id, user_id, status, created_at, approved_at)
      SELECT b.id, b.user_id, 'approved', ${createdExpr}, ${approvedExpr}
      FROM brackets b
      WHERE (${ "IFNULL(b.is_featured,0)=1" if hasIsFeatured else "0=1" } OR ${ "b.approved_at IS NOT NULL" if hasApprovedAt else "0=1" })
    `).run());

    await safeRun(env.DB.prepare(`
      UPDATE feature_requests
      SET status='approved',
          approved_at = COALESCE(approved_at, (
            SELECT ${approvedExpr} FROM brackets b WHERE b.id = feature_requests.bracket_id
          )),
          updated_at = COALESCE(updated_at, datetime('now'))
      WHERE bracket_id IN (
        SELECT b.id FROM brackets b
        WHERE (${ "IFNULL(b.is_featured,0)=1" if hasIsFeatured else "0=1" } OR ${ "b.approved_at IS NOT NULL" if hasApprovedAt else "0=1" })
      )
      AND lower(trim(status))!='approved'
    `).run());
  }
}

export async function onRequestGet({ env }){
  try{
    await ensureFeatureRequests(env);
    const rs = await env.DB.prepare(
      `SELECT fr.bracket_id, fr.caption, fr.approved_at, b.title
       FROM feature_requests fr
       JOIN brackets b ON b.id = fr.bracket_id
       WHERE lower(trim(fr.status))='approved'
       ORDER BY COALESCE(fr.approved_at, fr.updated_at, fr.created_at) DESC
       LIMIT 50`
    ).all();
    return json({ok:true, featured: rs.results || []});
  }catch(_){
    return json({ok:true, featured: [], warning: "featured_unavailable"});
  }
}
