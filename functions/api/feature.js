import { json, requireAdmin, requireUser } from "./_util.js";

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

      // If there is already a pending request for this bracket, treat as success.
      const existing = await env.DB.prepare(
        "SELECT id, status FROM feature_requests WHERE bracket_id = ? ORDER BY created_at DESC LIMIT 1"
      )
        .bind(bracket_id)
        .first();

      if (existing && normalizeStatus(existing.status) === "pending") {
        return json({ ok: true, already: true, request_id: existing.id });
      }

      const now = new Date().toISOString();
      const insert = await env.DB.prepare(
        "INSERT INTO feature_requests (bracket_id, user_id, status, created_at) VALUES (?, ?, ?, ?)"
      )
        .bind(bracket_id, b.user_id, "pending", now)
        .run();

      return json({ ok: true, request_id: insert.meta?.last_row_id || null });
    }

    if (method === "GET") {
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
      await requireAdmin(context);
      const body = await request.json().catch(() => ({}));
      const id = String(body.id || "").trim();
      const status = normalizeStatus(body.status);
      if (!id) return json({ ok: false, error: "Missing id" }, 400);
      if (!["pending", "approved", "denied"].includes(status)) {
        return json({ ok: false, error: "Invalid status" }, 400);
      }

      const now = new Date().toISOString();
      const out = await env.DB.prepare(
        "UPDATE feature_requests SET status = ?, updated_at = ? WHERE id = ?"
      )
        .bind(status, now, id)
        .run();

      return json({ ok: true, changed: out.meta?.changes || 0 });
    }

    return json({ ok: false, error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ ok: false, error: e?.message || String(e) }, 500);
  }
}
