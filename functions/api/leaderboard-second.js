import { SECOND_CHANCE_META, SECOND_CHANCE_RESULTS } from "./_leaderboard_second_static.js";
import { json, ensureUserSchema, ensureGamesSchema, requireUser } from "./_util.js";

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
  try{ await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_challenge ON challenge_entries(challenge, stage, user_id)").run(); }catch(_e){}
}

function normalizeTeamName(name){
  const n = String(name || "").trim();
  if(n === "Texas") return "Texas/NC State";
  return n;
}

function teamEq(a,b){
  return !!a && !!b && a.seed===b.seed && normalizeTeamName(a.name)===normalizeTeamName(b.name);
}

function normalizeGameId(id){
  return String(id || "").replace(/^REGION_/, "");
}

function gameGroupFromId(id){
  const norm = normalizeGameId(id);
  const m = norm.match(/^(SOUTH|EAST|WEST|MIDWEST)__R(\d)__G(\d+)$/);
  if(m){
    const r = Number(m[2]);
    if(r===2 || r===3) return "sc";
  }
  if(norm.startsWith("FF__G") || norm==="FINAL") return "sc";
  return null;
}

function pickForGame(picks, id){
  const norm = normalizeGameId(id);
  if(norm.startsWith("FF__G")) return picks[norm + "__winner"] || picks[id + "__winner"] || null;
  if(norm==="FINAL") return picks["FINAL__winner"] || null;
  return picks[id + "__winner"] || picks[norm + "__winner"] || null;
}

function championPick(picks){
  return picks["CHAMPION"] || null;
}

function tieBreaker(picks){
  const v = picks["TIEBREAKER_TOTAL"];
  const n = v===undefined||v===null||v==="" ? null : Number(v);
  return Number.isFinite(n) ? n : null;
}

function mergeSheetFinalizedGames(finalized){
  const map = new Map();
  for(const g of finalized || []){
    map.set(normalizeGameId(g.id), g);
  }
  for(const g of (SECOND_CHANCE_RESULTS || [])){
    const key = normalizeGameId(g.id);
    if(!map.has(key)){
      map.set(key, {
        id: g.id,
        winner: { name: g.winner, seed: null },
        loser: g.loser ? { name: g.loser, seed: null } : null,
        score_total: null
      });
    }
  }
  return Array.from(map.values());
}

export async function onRequestGet({ request, env }){
  await ensureTables(env);
  await ensureUserSchema(env);
  await ensureGamesSchema(env);

  const url = new URL(request.url);
  const challenge = (url.searchParams.get("challenge")||"best").toLowerCase();
  if(!["best","worst"].includes(challenge)) return json({ok:false, error:"Invalid challenge."}, 400);

  const gq = await env.DB.prepare("SELECT id, winner_json, score_total FROM games WHERE winner_json IS NOT NULL").all();
  let finalized = (gq.results||[]).map(r=>({
    id: r.id,
    winner: r.winner_json ? JSON.parse(r.winner_json) : null,
    score_total: r.score_total===null||r.score_total===undefined ? null : Number(r.score_total)
  })).filter(g => gameGroupFromId(g.id)==="sc");

  finalized = mergeSheetFinalizedGames(finalized);

  const TOTAL_GAMES = 15;
  const finalizedCount = Number(SECOND_CHANCE_META?.games_played || finalized.length || 0);
  const remainingGames = Math.max(0, TOTAL_GAMES - finalizedCount);
  const finalRow = finalized.find(g => normalizeGameId(g.id) === "FINAL");
  const actualFinalTotal = finalRow && Number.isFinite(finalRow.score_total) ? finalRow.score_total : null;

  let me_user_id = null;
  try{
    const me = await requireUser({request, env});
    me_user_id = me?.id ?? null;
  }catch{ me_user_id = null; }

  const ent = await env.DB.prepare(
    "SELECT e.user_id, e.bracket_id, MAX(b.title) AS bracket_title, MAX(u.email) AS email FROM challenge_entries e JOIN users u ON u.id=e.user_id JOIN brackets b ON b.id=e.bracket_id WHERE e.challenge=? AND e.stage='sc' GROUP BY e.user_id, e.bracket_id"
  ).bind(challenge).all();

  let entries = ent.results || [];
  const seen = new Set();
  entries = entries.filter(row=>{
    const key = String(row.bracket_id || "");
    if(!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if(entries.length===0){
    return json({ok:true, leaderboard: [], me_user_id, total_games: TOTAL_GAMES, finalized_games: finalizedCount});
  }

  const ids = entries.map(e => e.bracket_id);
  const placeholders = ids.map(()=>"?").join(",");
  const bq = await env.DB.prepare(`SELECT id, data_json, title FROM brackets WHERE id IN (${placeholders})`).bind(...ids).all();
  const bmap = new Map((bq.results||[]).map(b => [b.id, { data: JSON.parse(b.data_json || "{}"), title: b.title }]));

  const rows = entries.map(e=>{
    const b = bmap.get(e.bracket_id);
    const picks = (b?.data?.picks) ? b.data.picks : (b?.data || {});
    let x = 0;

    for(const g of finalized){
      const pick = pickForGame(picks, g.id);
      if(!pick) continue;

      if(challenge==="best"){
        if(teamEq(pick, g.winner)) x += 1;
      } else {
        const loserName = g?.loser?.name || g?.loser || null;
        if(loserName){
          if(normalizeTeamName(pick?.name) === normalizeTeamName(loserName)) x += 1;
        } else if(!teamEq(pick, g.winner)) {
          x += 1;
        }
      }
    }

    const score = x * 10;
    const champ = championPick(picks);
    const tb = tieBreaker(picks);
    const diff = (actualFinalTotal!==null && tb!==null) ? Math.abs(tb-actualFinalTotal) : null;

    return {
      user_id: e.user_id,
      display_name: (e.bracket_title || (e.email ? e.email.split("@")[0] : "Bracket")),
      bracket_id: e.bracket_id,
      title: b?.title || "Bracket",
      score,
      x,
      y: finalizedCount,
      total_possible: score + (remainingGames * 10),
      pct: finalizedCount ? (x / finalizedCount) : 0,
      champion: champ ? `${champ.seed} ${champ.name}` : "",
      tiebreaker: tb,
      tiebreaker_diff: diff
    };
  });

  rows.sort((a,b)=>{
    if(b.score!==a.score) return b.score-a.score;
    if(actualFinalTotal!==null){
      const ad = (a.tiebreaker_diff===null)? 10**9 : a.tiebreaker_diff;
      const bd = (b.tiebreaker_diff===null)? 10**9 : b.tiebreaker_diff;
      if(ad!==bd) return ad-bd;
    }
    return (a.display_name || "").localeCompare(b.display_name || "");
  });

  let rank = 0, prevScore = null, prevDiff = null, count = 0;
  const out = rows.map(row=>{
    count += 1;
    const curScore = row.score;
    const curDiff = actualFinalTotal!==null ? (row.tiebreaker_diff===null ? 10**9 : row.tiebreaker_diff) : null;
    const same = (prevScore===curScore) && (actualFinalTotal===null || prevDiff===curDiff);
    if(!same){ rank = count; prevScore = curScore; prevDiff = curDiff; }
    return { rank, ...row };
  });

  return json({ok:true, leaderboard: out, me_user_id, total_games: TOTAL_GAMES, finalized_games: finalizedCount});
}
