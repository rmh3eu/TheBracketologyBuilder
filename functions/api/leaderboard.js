import { STATIC_BEST_LEADERBOARD, STATIC_WORST_LEADERBOARD, STATIC_LEADERBOARD_META } from "./_leaderboard_static.js";
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
    challenge TEXT NOT NULL, -- best|worst
    stage TEXT NOT NULL DEFAULT 'pre', -- pre|r16|f4
    bracket_id TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_challenge ON challenge_entries(challenge, stage, user_id)").run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    challenge TEXT NOT NULL,
    name TEXT NOT NULL,
    is_public INTEGER NOT NULL DEFAULT 0,
    join_password_hash TEXT,
    created_by INTEGER,
    created_at TEXT NOT NULL
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS group_members (
    group_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at TEXT NOT NULL,
    PRIMARY KEY (group_id, user_id)
  )`).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id)").run();
}

function teamEq(a,b){ return a && b && a.seed===b.seed && a.name===b.name; }

function gameGroupFromId(id){
  // Returns which Worst-stage bucket a finalized game belongs to.
  // Stage 1: R64 + R32
  // Stage 2: S16 + E8
  // Stage 3: Final Four + Final
  const m = id.match(/^(SOUTH|EAST|WEST|MIDWEST)__R(\d)__G(\d+)$/);
  if(m){
    const r = Number(m[2]);
    if(r===0 || r===1) return "pre";
    if(r===2 || r===3) return "r16";
  }
  if(id.startsWith("FF__G") || id==="FINAL") return "f4";
  return null;
}

function pickForGame(picks, id){
  // id stored without __winner
  if(id.startsWith("FF__G")) return picks[id + "__winner"] || null;
  if(id==="FINAL") return picks["FINAL__winner"] || null;
  return picks[id + "__winner"] || null;
}

function championPick(picks){ return picks["CHAMPION"] || null; }
function tieBreaker(picks){
  const v = picks["TIEBREAKER_TOTAL"];
  const n = v===undefined||v===null||v==="" ? null : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function onRequestGet({ request, env }){
  await ensureTables(env);
  await ensureUserSchema(env);
  await ensureGamesSchema(env);

  const url = new URL(request.url);
  const challenge = (url.searchParams.get("challenge")||"best").toLowerCase();
  const stage = (url.searchParams.get('stage')||'pre').toLowerCase();
  const groupId = url.searchParams.get("group");
  if(!['best','worst'].includes(challenge)) return json({ok:false, error:"Invalid challenge."}, 400);
  if(!['pre','r16','f4','sc'].includes(stage)) return json({ok:false, error:"Invalid stage."}, 400);

  let group = null;
  // Static spreadsheet-based leaderboard override for overall pre-stage boards.
  // This avoids any live score recomputation against saved bracket data.
  if(!groupId && stage === 'pre'){
    let me_user_id = null;
    try{
      const me = await requireUser({request, env});
      me_user_id = me?.id ?? null;
    }catch{ me_user_id = null; }

    const staticRows = challenge === 'best' ? STATIC_BEST_LEADERBOARD : STATIC_WORST_LEADERBOARD;
    return json({
      ok: true,
      leaderboard: staticRows,
      group: null,
      me_user_id,
      total_games: 63,
      finalized_games: Number(STATIC_LEADERBOARD_META?.games_played || 0)
    });
  }

  if(groupId){
    group = await env.DB.prepare(
      `SELECT g.id, g.challenge, g.name,
        (SELECT COUNT(1) FROM group_members gm WHERE gm.group_id = g.id) AS member_count
       FROM groups g WHERE g.id=?`
    ).bind(groupId).first();
    if(!group) return json({ok:false, error:"Group not found."}, 404);
    if(String(group.challenge).toLowerCase() !== challenge) return json({ok:false, error:"Group challenge mismatch."}, 400);
  }

  // Load finalized games
  const gq = await env.DB.prepare("SELECT id, winner_json, score_total FROM games WHERE winner_json IS NOT NULL").all();
  const finalized = (gq.results||[]).map(r=>({
    id: r.id,
    winner: r.winner_json ? JSON.parse(r.winner_json) : null,
    score_total: r.score_total===null||r.score_total===undefined ? null : Number(r.score_total)
  }));

  // NCAA tournament main bracket (no play-in): 63 games total
  const TOTAL_GAMES = 63;
  const finalizedCount = finalized.filter(g=>gameGroupFromId(g.id)!==null).length;
  const remainingGames = Math.max(0, TOTAL_GAMES - finalizedCount);

  // Determine actual final total for tie-break
  const finalRow = finalized.find(g=>g.id==="FINAL");
  const actualFinalTotal = finalRow && Number.isFinite(finalRow.score_total) ? finalRow.score_total : null;

  // Optional viewer identity (for highlighting the viewer's row client-side)
  let me_user_id = null;
  try{
    const me = await requireUser({request, env});
    me_user_id = me?.id ?? null;
  }catch{ me_user_id = null; }

  if(challenge === "best"){
    let q = "SELECT e.user_id, e.bracket_id, MAX(b.title) AS bracket_title, MAX(u.email) AS email FROM challenge_entries e JOIN users u ON u.id=e.user_id JOIN brackets b ON b.id=e.bracket_id";
    const binds = [];
    if(groupId){
      q += " JOIN group_members gm ON gm.user_id = e.user_id";
    }
    q += " WHERE e.challenge='best' AND e.stage='pre'";
    if(groupId){
      q += " AND gm.group_id=?";
      binds.push(groupId);
    }
    q += " GROUP BY e.user_id, e.bracket_id";
    const ent = await env.DB.prepare(q).bind(...binds).all();
    let entries = ent.results||[];
    // Hide duplicate submissions of the same bracket within the same challenge.
    const seenBestBracketIds = new Set();
    entries = entries.filter(row=>{
      const key = String(row.bracket_id||'');
      if(!key) return false;
      if(seenBestBracketIds.has(key)) return false;
      seenBestBracketIds.add(key);
      return true;
    });
    if(entries.length===0) return json({ok:true, leaderboard: [], group, me_user_id});

    const ids = entries.map(e=>e.bracket_id);
    const placeholders = ids.map(()=>'?').join(',');
    const bq = await env.DB.prepare(`SELECT id, data_json, title FROM brackets WHERE id IN (${placeholders})`).bind(...ids).all();
    const bmap = new Map((bq.results||[]).map(b=>[b.id, { data: JSON.parse(b.data_json||"{}"), title: b.title }]));

    const totalGames = TOTAL_GAMES;
    const scored = entries.map(e=>{
      const b = bmap.get(e.bracket_id);
      const picks = b?.data || {};
      let correct = 0;
      let seen = 0;
      finalized.forEach(g=>{
        const grp = gameGroupFromId(g.id);
        if(!grp) return;
        const pick = pickForGame(picks, g.id);
        if(!pick) return;
        seen += 1;
        if(teamEq(pick, g.winner)) correct += 1;
      });
      const champ = championPick(picks);
      const tb = tieBreaker(picks);
      const diff = (actualFinalTotal!==null && tb!==null) ? Math.abs(tb-actualFinalTotal) : null;
      const score = correct * 10;
      return {
        user_id: e.user_id,
        display_name: (e.bracket_title || (e.email ? e.email.split('@')[0] : 'Bracket')),
        bracket_id: e.bracket_id,
        title: b?.title || "Bracket",
        // Each correct pick is worth 10 points.
        score,
        x: score,
        y: totalGames * 10,
        total_possible: score + (remainingGames * 10),
        // pct remains based on correctness rate, not points.
        pct: totalGames ? (correct/totalGames) : 0,
        champion: champ,
        tiebreaker: tb,
        tiebreaker_diff: diff
      };
    });

    scored.sort((a,b)=>{
      if(b.score!==a.score) return b.score-a.score;
      // If final is known + total provided, use closest tiebreaker
      if(actualFinalTotal!==null){
        const ad = (a.tiebreaker_diff===null)? 10**9 : a.tiebreaker_diff;
        const bd = (b.tiebreaker_diff===null)? 10**9 : b.tiebreaker_diff;
        if(ad!==bd) return ad-bd;
      }
      return (a.display_name||'').localeCompare(b.display_name||'');
    });

    // assign ranks with ties
    let rank=0, prevScore=null, prevDiff=null, count=0;
    const out=scored.map(row=>{
      count+=1;
      const curScore=row.score;
      const curDiff=actualFinalTotal!==null ? (row.tiebreaker_diff===null?10**9:row.tiebreaker_diff) : null;
      const same = (prevScore===curScore) && (actualFinalTotal===null || prevDiff===curDiff);
      if(!same){ rank=count; prevScore=curScore; prevDiff=curDiff; }
      return { rank, ...row };
    });

    return json({ok:true, leaderboard: out, actual_final_total: actualFinalTotal, group, me_user_id, total_games: TOTAL_GAMES, finalized_games: finalizedCount});
  }

  // WORST: one visible/counting row per unique bracket_id (duplicates hidden from standings).
  let q = "SELECT e.id AS entry_id, e.user_id, e.stage, e.bracket_id, b.title AS bracket_title, u.email, e.created_at, e.updated_at FROM challenge_entries e JOIN users u ON u.id=e.user_id JOIN brackets b ON b.id=e.bracket_id";
  const binds = [];
  if(groupId){
    q += " JOIN group_members gm ON gm.user_id = e.user_id";
  }
  q += " WHERE e.challenge='worst'";
  if(groupId){
    q += " AND gm.group_id=?";
    binds.push(groupId);
  }
  q += " ORDER BY COALESCE(e.created_at, e.updated_at, '') ASC, e.id ASC";
  const ent = await env.DB.prepare(q).bind(...binds).all();
  let entries = ent.results || [];
  const seenWorstBracketIds = new Set();
  entries = entries.filter(row=>{
    const key = String(row.bracket_id || '');
    if(!key) return false;
    if(seenWorstBracketIds.has(key)) return false;
    seenWorstBracketIds.add(key);
    return true;
  });
  if(entries.length===0) return json({ok:true, leaderboard: [], group, me_user_id});

  const allIds = entries.map(e=>e.bracket_id).filter(Boolean);
  const placeholders = allIds.map(()=>'?').join(',');
  const bq = allIds.length ? await env.DB.prepare(`SELECT id, data_json, title FROM brackets WHERE id IN (${placeholders})`).bind(...allIds).all() : {results:[]};
  const bmap = new Map((bq.results||[]).map(b=>[b.id, { data: JSON.parse(b.data_json||"{}"), title: b.title }]));

  const totals = { pre:480, r16:120, f4:30 };
  const overallTotal = (TOTAL_GAMES * 10);
  const rows = [];
  for(const e of entries){
    const picks = (bmap.get(e.bracket_id)?.data) || {};
    const stageScores = { pre:0, r16:0, f4:0 };
    const stageSeen = { pre:0, r16:0, f4:0 };

    for(const g of finalized){
      const grp = gameGroupFromId(g.id);
      if(!grp) continue;
      const pick = pickForGame(picks, g.id);
      if(!pick) continue;
      stageSeen[grp] += 1;
      if(!teamEq(pick, g.winner)) stageScores[grp] += 10;
    }

    const score = stageScores.pre + stageScores.r16 + stageScores.f4;
    const finishedPossible = (stageSeen.pre*10) + (stageSeen.r16*10) + (stageSeen.f4*10);
    const total_possible = score + Math.max(0, overallTotal - finishedPossible);
    const champ = championPick(picks);
    const tb = tieBreaker(picks);
    const diff = (actualFinalTotal!==null && tb!==null) ? Math.abs(tb-actualFinalTotal) : null;

    rows.push({
      entry_id: e.entry_id,
      user_id: e.user_id,
      display_name: (e.bracket_title || (e.email ? e.email.split('@')[0] : 'Bracket')),
      bracket_id: e.bracket_id,
      title: bmap.get(e.bracket_id)?.title || e.bracket_title || 'Bracket',
      score,
      x: score,
      y: overallTotal,
      total_possible,
      pct: overallTotal ? (score/overallTotal) : 0,
      stage1: stageScores.pre,
      stage2: stageScores.r16,
      stage3: stageScores.f4,
      champion: champ ? `${champ.seed} ${champ.name}` : "",
      tiebreaker: tb,
      tiebreaker_diff: diff
    });
  }

  if(!rows.length){
    return json({ok:true, leaderboard: [], totals_by_stage: totals, group, me_user_id, total_games: TOTAL_GAMES, finalized_games: finalizedCount});
  }

  rows.sort((a,b)=>{
    if(b.score!==a.score) return b.score-a.score;
    if(actualFinalTotal!==null){
      const ad = (a.tiebreaker_diff===null)? 10**9 : a.tiebreaker_diff;
      const bd = (b.tiebreaker_diff===null)? 10**9 : b.tiebreaker_diff;
      if(ad!==bd) return ad-bd;
    }
    return (a.display_name||'').localeCompare(b.display_name||'');
  });

  let rank=0, prevScore=null, prevDiff=null, count=0;
  const out = rows.map(row=>{
    count+=1;
    const curScore=row.score;
    const curDiff=actualFinalTotal!==null ? (row.tiebreaker_diff===null?10**9:row.tiebreaker_diff) : null;
    const same = (prevScore===curScore) && (actualFinalTotal===null || prevDiff===curDiff);
    if(!same){ rank=count; prevScore=curScore; prevDiff=curDiff; }
    return { rank, ...row };
  });

  return json({ok:true, leaderboard: out, totals_by_stage: totals, group, me_user_id, total_games: TOTAL_GAMES, finalized_games: finalizedCount});
}
