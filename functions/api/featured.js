import { json } from "./_util.js";

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

  // Backfill approved/featured from legacy bracket flags.
  await env.DB.prepare(`
    INSERT OR IGNORE INTO feature_requests (bracket_id, user_id, status, created_at, approved_at)
    SELECT b.id, b.user_id, 'approved', COALESCE(b.submitted_at, b.updated_at, b.created_at), COALESCE(b.approved_at, b.updated_at, b.created_at)
    FROM brackets b
    WHERE (IFNULL(b.is_featured,0)=1 OR b.approved_at IS NOT NULL)
  `).run();
}

export async function onRequestGet({ env }){
  await ensureFeatureRequests(env);
  const rs = await env.DB.prepare(
    `SELECT fr.bracket_id, fr.caption, fr.approved_at, b.title
     FROM feature_requests fr
     JOIN brackets b ON b.id = fr.bracket_id
     WHERE fr.status='approved'
     ORDER BY fr.approved_at DESC
     LIMIT 50`
  ).all();
  return json({ok:true, featured: rs.results || []});
}
