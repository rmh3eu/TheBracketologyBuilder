import { json } from './_util.js';

const WINNERS = ["TCU","Nebraska","Louisville","High Point","Duke","Vanderbilt"];
const LOSERS = ["Ohio St","Troy","USF","Wisconsin","Siena","McNeese"];

function getPicksFromData(data){
  if(!data || typeof data !== 'object') return {};
  if(data.picks && typeof data.picks === 'object') return data.picks;
  const out = { ...data };
  delete out.base;
  delete out.base_version;
  return out;
}

export async function onRequestGet({ env }) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS challenge_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    challenge TEXT NOT NULL,
    stage TEXT NOT NULL DEFAULT 'pre',
    bracket_id TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();

  const ent = await env.DB.prepare(
    "SELECT id, challenge, bracket_id, score FROM challenge_entries WHERE stage='pre'"
  ).all();

  let updated = 0;
  let bestUpdated = 0;
  let worstUpdated = 0;

  for (const e of (ent.results || [])) {
    const b = await env.DB.prepare("SELECT data_json FROM brackets WHERE id=?").bind(e.bracket_id).first();
    if (!b) continue;

    let data = {};
    try { data = JSON.parse(b.data_json || '{}'); } catch (_) { data = {}; }
    const picksObj = getPicksFromData(data);
    const picksStr = JSON.stringify(picksObj);

    let score = 0;
    if (e.challenge === 'best') {
      for (const team of WINNERS) {
        if (picksStr.includes(team)) score += 10;
      }
      bestUpdated++;
    } else if (e.challenge === 'worst') {
      for (const team of LOSERS) {
        if (picksStr.includes(team)) score += 10;
      }
      worstUpdated++;
    } else {
      continue;
    }

    await env.DB.prepare(
      "UPDATE challenge_entries SET score=?, updated_at=? WHERE id=?"
    ).bind(score, new Date().toISOString(), e.id).run();

    updated++;
  }

  return new Response(
    [
      "Round of 64 scoring applied to challenge entries.",
      "Best winners: TCU, Nebraska, Louisville, High Point, Duke, Vanderbilt",
      "Worst losers: Ohio St, Troy, USF, Wisconsin, Siena, McNeese",
      `Updated entries: ${updated}`,
      `Best entries updated: ${bestUpdated}`,
      `Worst entries updated: ${worstUpdated}`,
      "",
      "Refresh the challenge pages to see updated leaderboard scores."
    ].join("\n"),
    { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } }
  );
}