import { json } from "./_util.js";

async function ensureChallengeEntriesSchema(env){
  try{
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS challenge_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      challenge TEXT NOT NULL,
      stage TEXT NOT NULL DEFAULT 'pre',
      bracket_id TEXT NOT NULL DEFAULT '',
      score INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`).run();
  }catch(_e){}
}

export async function onRequestGet({ env }){
  await ensureChallengeEntriesSchema(env);
  let rs;
  try{
    rs = await env.DB.prepare(
      `SELECT fr.bracket_id, fr.caption, fr.approved_at, b.title,
              EXISTS(
                SELECT 1 FROM challenge_entries ce
                 WHERE ce.bracket_id = fr.bracket_id
                   AND LOWER(ce.challenge)='best'
                 LIMIT 1
              ) AS entered_best,
              EXISTS(
                SELECT 1 FROM challenge_entries ce
                 WHERE ce.bracket_id = fr.bracket_id
                   AND LOWER(ce.challenge)='worst'
                 LIMIT 1
              ) AS entered_worst
         FROM feature_requests fr
         JOIN brackets b ON b.id = fr.bracket_id
        WHERE fr.status='approved'
        ORDER BY fr.approved_at DESC
        LIMIT 50`
    ).all();
  }catch(_e){
    rs = await env.DB.prepare(
      `SELECT fr.bracket_id, fr.caption, fr.approved_at, b.title
         FROM feature_requests fr
         JOIN brackets b ON b.id = fr.bracket_id
        WHERE fr.status='approved'
        ORDER BY fr.approved_at DESC
        LIMIT 50`
    ).all();
  }
  return json({ok:true, featured: rs.results || []});
}
