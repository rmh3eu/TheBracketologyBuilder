const WINNERS = ["TCU","Nebraska","Louisville","High Point","Duke","Vanderbilt","Arkansas","Michigan St"];
const LOSERS = ["Ohio St","Troy","USF","Wisconsin","Siena","McNeese","Hawaii","N Dakota St"];

function getRound64Advances(dataJson){
  let data = {};
  try{ data = JSON.parse(dataJson || "{}"); }catch(_e){ data = {}; }
  const picks = (data && typeof data.picks === 'object') ? data.picks : data;
  const names = [];
  for(const [key, val] of Object.entries(picks || {})){
    if(!/__R0__G\d+__winner$/.test(key)) continue;
    if(val && typeof val === 'object' && val.name) names.push(String(val.name));
  }
  return names;
}

export async function onRequestGet({ env }){
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

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS scoring_meta (
    stage TEXT PRIMARY KEY,
    completed_games INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT ''
  )`).run();

  const rows = await env.DB.prepare("SELECT id, challenge, bracket_id FROM challenge_entries WHERE stage='pre'").all();
  let updated = 0;
  const now = new Date().toISOString();

  for(const r of (rows.results || [])){
    const b = await env.DB.prepare("SELECT data_json FROM brackets WHERE id=?").bind(r.bracket_id).first();
    if(!b) continue;

    const advances = getRound64Advances(b.data_json);
    let score = 0;
    if(String(r.challenge) === 'best'){
      for(const team of WINNERS){
        if(advances.includes(team)) score += 10;
      }
    } else if(String(r.challenge) === 'worst'){
      for(const team of LOSERS){
        if(advances.includes(team)) score += 10;
      }
    } else {
      continue;
    }

    await env.DB.prepare("UPDATE challenge_entries SET score=?, updated_at=? WHERE id=?")
      .bind(score, now, r.id).run();
    updated += 1;
  }

  await env.DB.prepare(
    "INSERT INTO scoring_meta(stage, completed_games, updated_at) VALUES('pre', ?, ?) ON CONFLICT(stage) DO UPDATE SET completed_games=excluded.completed_games, updated_at=excluded.updated_at"
  ).bind(8, now).run();

  return new Response(
    [
      "Round of 64 scoring applied.",
      "Completed games set to 8.",
      "Best winners: TCU, Nebraska, Louisville, High Point, Duke, Vanderbilt, Arkansas, Michigan St",
      "Worst losers: Ohio St, Troy, USF, Wisconsin, Siena, McNeese, Hawaii, N Dakota St",
      `Updated entries: ${updated}`
    ].join("\n"),
    { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } }
  );
}
