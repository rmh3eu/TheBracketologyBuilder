import { json } from "./_util.js";

export async function onRequestGet({ env }){
  const rs = await env.DB.prepare(
    `SELECT fr.bracket_id, fr.caption, fr.approved_at, b.title,
            EXISTS(
              SELECT 1 FROM challenge_entries ce
               WHERE ce.bracket_id = fr.bracket_id
                 AND LOWER(ce.challenge) = 'best'
               LIMIT 1
            ) AS entered_best,
            EXISTS(
              SELECT 1 FROM challenge_entries ce
               WHERE ce.bracket_id = fr.bracket_id
                 AND LOWER(ce.challenge) = 'worst'
               LIMIT 1
            ) AS entered_worst
     FROM feature_requests fr
     JOIN brackets b ON b.id = fr.bracket_id
     WHERE fr.status='approved'
     ORDER BY fr.approved_at DESC
     LIMIT 50`
  ).all();
  return json({ok:true, featured: rs.results || []});
}
