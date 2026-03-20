import { json, ensureGamesSchema } from "./_util.js";

async function ensureTables(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    stage TEXT NOT NULL,
    region TEXT,
    game_index INTEGER NOT NULL,
    team1_json TEXT,
    team2_json TEXT,
    winner_json TEXT,
    updated_at TEXT,
    score_total INTEGER
  )`).run();
}

export async function onRequestGet({ request, env }){
  await ensureTables(env);
  await ensureGamesSchema(env);

  const rows = await env.DB.prepare("SELECT id, stage, region, game_index, team1_json, team2_json, winner_json, updated_at, score_total FROM games").all();
  const games = (rows.results||[]).map(r=>({
    id: r.id,
    stage: r.stage,
    region: r.region,
    game_index: r.game_index,
    team1: r.team1_json ? JSON.parse(r.team1_json) : null,
    team2: r.team2_json ? JSON.parse(r.team2_json) : null,
    winner: r.winner_json ? JSON.parse(r.winner_json) : null,
    updated_at: r.updated_at,
    score_total: r.score_total===null||r.score_total===undefined ? null : Number(r.score_total)
  }));

  return json({ok:true, games});
}
