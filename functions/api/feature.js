import { json, requireAdmin, requireUser } from "./_util.js";

// Ensure the feature_requests table exists and backfill rows from legacy
// bracket columns (submitted_at / approved_at / is_featured) so that
// previously-submitted/featured brackets still appear in Admin: Featured Review.
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

  // Pending submissions (idempotent)
  await env.DB.prepare(`
    INSERT OR IGNORE INTO feature_requests (bracket_id, user_id, status, created_at)
    SELECT b.id, b.user_id, 'pending', COALESCE(b.submitted_at, b.updated_at, b.created_at)
    FROM brackets b
    WHERE b.submitted_at IS NOT NULL
      AND (b.approved_at IS NULL AND IFNULL(b.is_featured,0)=0)
  `).run();

  // Approved/featured (idempotent)
  await env.DB.prepare(`
    INSERT OR IGNORE INTO feature_requests (bracket_id, user_id, status, created_at, approved_at)
    SELECT b.id, b.user_id, 'approved', COALESCE(b.submitted_at, b.updated_at, b.created_at), COALESCE(b.approved_at, b.updated_at, b.created_at)
    FROM brackets b
    WHERE (IFNULL(b.is_featured,0)=1 OR b.approved_at IS NOT NULL)
  `).run();
}

// Feature Requests API
//
// POST   /api/feature          (user)   { bracket_id }
// GET    /api/feature?status=  (admin)  status in: pending|approved|denied|rejected|all
// PUT    /api/feature          (admin)  { id, status } status in: pending|approved|denied|rejected
//
// Notes:
// - We normalize "rejected" -> "denied" (legacy naming).
// - We allow incomplete brackets to be submitted (per latest decision).

function normalizeStatus(raw) {
  const s = (raw || "").toLowerCase().trim();
  if (!s) return "all";
  if (s === "rejected") return "denied";
  if (s === "deny") return "denied";
  return s;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  try {
    if (method === "POST") {
      await ensureFeatureRequests(env);
      const user = await requireUser(context);
      const body = await request.json().catch(() => ({}));
      const bracket_id = String(body.bracket_id || "").trim();
      if (!bracket_id) return json({ ok: false, error: "Missing bracket_id" }, 400);

      const b = await env.DB.prepare(
        "SELECT id, user_id, title, created_at FROM brackets WHERE id = ?"
      )
        .bind(bracket_id)
        .first();

      if (!b) return json({ ok: false, error: "Bracket not found" }, 404);
      if (!user.is_admin && b.user_id !== user.id) {
        return json({ ok: false, error: "Not allowed" }, 403);
      }

      
      const existing = await env.DB.prepare(
        "SELECT id, status FROM feature_requests WHERE bracket_id = ? ORDER BY created_at DESC LIMIT 1"
      ).bind(bracket_id).first();

// If there is already a request for this bracket (any status), treat as success (idempotent).
      // This prevents UNIQUE constraint errors if users click multiple times or if admin already approved/denied.
      if (existing) {
        return json({ ok: true, already: true, status: normalizeStatus(existing.status), request_id: existing.id });
      }

      const now = new Date().toISOString();

      // Persist on brackets table too (legacy + reporting)
      await env.DB.prepare(
        "UPDATE brackets SET submitted_at = COALESCE(submitted_at, ?) WHERE id = ?"
      )
        .bind(now, bracket_id)
        .run();
      const insert = await env.DB.prepare(
        "INSERT OR IGNORE INTO feature_requests (bracket_id, user_id, status, created_at) VALUES (?, ?, ?, ?)"
      )
        .bind(bracket_id, b.user_id, "pending", now)
        .run();

      // If it was ignored (already exists), return the existing request id/status.
      const fr = await env.DB.prepare(
        "SELECT id, status FROM feature_requests WHERE bracket_id = ? ORDER BY created_at DESC LIMIT 1"
      ).bind(bracket_id).first();

      return json({ ok: true, request_id: fr?.id || insert.meta?.last_row_id || null, status: normalizeStatus(fr?.status || "pending") });
    }

    if (method === "GET") {
      await ensureFeatureRequests(env);
      await requireAdmin(context);
      const status = normalizeStatus(url.searchParams.get("status") || "all");

      let where = "";
      const binds = [];
      if (status !== "all") {
        if (!["pending", "approved", "denied"].includes(status)) {
          return json({ ok: false, error: "Invalid status" }, 400);
        }
        where = "WHERE fr.status = ?";
        binds.push(status);
      }

      const stmt = env.DB.prepare(
        `
        SELECT
          fr.id,
          fr.bracket_id,
          fr.user_id,
          fr.status,
          fr.created_at,
          fr.updated_at,
          u.email,
          b.title
        FROM feature_requests fr
        LEFT JOIN users u ON u.id = fr.user_id
        LEFT JOIN brackets b ON b.id = fr.bracket_id
        ${where}
        ORDER BY fr.created_at DESC
        `
      );

      const res = binds.length ? await stmt.bind(...binds).all() : await stmt.all();
      const rows = (res?.results || []).map((r) => ({
        ...r,
        status: normalizeStatus(r.status),
      }));

      return json({ ok: true, results: rows });
    }

    if (method === "PUT") {
      await ensureFeatureRequests(env);
      await requireAdmin(context);
      const body = await request.json().catch(() => ({}));
      const id = String(body.id || "").trim();
      const status = normalizeStatus(body.status);
      if (!id) return json({ ok: false, error: "Missing id" }, 400);
      if (!["pending", "approved", "denied"].includes(status)) {
        return json({ ok: false, error: "Invalid status" }, 400);
      }

      const now = new Date().toISOString();

      // Fetch the bracket_id so we can keep brackets table in sync
      const fr = await env.DB.prepare(
        "SELECT bracket_id FROM feature_requests WHERE id = ?"
      )
        .bind(id)
        .first();

      const out = await env.DB.prepare(
        "UPDATE feature_requests SET status = ?, updated_at = ? WHERE id = ?"
      )
        .bind(status, now, id)
        .run();

      // Mirror status onto brackets table
      if (fr?.bracket_id) {
        if (status === "approved") {
          await env.DB.prepare(
            "UPDATE brackets SET is_featured = 1, approved_at = COALESCE(approved_at, ?) WHERE id = ?"
          )
            .bind(now, fr.bracket_id)
            .run();
        } else if (status === "pending") {
          await env.DB.prepare(
            "UPDATE brackets SET is_featured = 0, approved_at = NULL WHERE id = ?"
          )
            .bind(fr.bracket_id)
            .run();
        } else if (status === "denied") {
          await env.DB.prepare(
            "UPDATE brackets SET is_featured = 0 WHERE id = ?"
          )
            .bind(fr.bracket_id)
            .run();
        }
      }

      return json({ ok: true, changed: out.meta?.changes || 0 });
    }

    return json({ ok: false, error: "Method not allowed" }, 405);
  } catch (e) {
    const msg = e?.message || String(e);
    if (String(msg).includes('UNIQUE constraint failed') && String(msg).includes('feature_requests.bracket_id')) {
      return json({ ok: true, already: true, status: 'pending' }, 200);
    }
    return json({ ok: false, error: msg }, 500);
  }
}
