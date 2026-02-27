import { json } from "./_util.js";

export async function onRequestGet({ env }){
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
