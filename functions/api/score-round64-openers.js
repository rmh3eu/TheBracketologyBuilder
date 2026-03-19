
const WINNERS = ["TCU","Nebraska","Louisville","High Point","Duke","Vanderbilt"];
const LOSERS = ["Ohio St","Troy","USF","Wisconsin","Siena","McNeese"];

function getPicks(data){
  if(!data) return "";
  try{
    const obj = JSON.parse(data);
    return JSON.stringify(obj);
  }catch{
    return "";
  }
}

export async function onRequestGet({ env }) {

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS scoring_meta (
    stage TEXT PRIMARY KEY,
    completed_games INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT ''
  )`).run();

  const rows = await env.DB.prepare("SELECT id, challenge, bracket_id FROM challenge_entries WHERE stage='pre'").all();

  let updated = 0;

  for(const r of (rows.results || [])){
    const b = await env.DB.prepare("SELECT data_json FROM brackets WHERE id=?").bind(r.bracket_id).first();
    if(!b) continue;

    const picks = getPicks(b.data_json);
    let score = 0;

    if(r.challenge === "best"){
      for(const t of WINNERS){
        if(picks.includes(t)) score += 10;
      }
    } else if(r.challenge === "worst"){
      for(const t of LOSERS){
        if(picks.includes(t)) score += 10;
      }
    }

    await env.DB.prepare(
      "UPDATE challenge_entries SET score=?, updated_at=? WHERE id=?"
    ).bind(score, new Date().toISOString(), r.id).run();

    updated++;
  }

  await env.DB.prepare(
    "INSERT INTO scoring_meta(stage, completed_games, updated_at) VALUES('pre', ?, ?) ON CONFLICT(stage) DO UPDATE SET completed_games=excluded.completed_games"
  ).bind(6, new Date().toISOString()).run();

  return new Response("Scoring applied. Updated: " + updated);
}
