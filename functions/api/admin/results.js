import { json, requireUser, isAdmin, ensureGamesSchema, ensureMilestones, sendResendEmail, ensureUserSchema, getSiteDomain } from "../_util.js";

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



async function getWorstParticipantEmails(env){
  await ensureUserSchema(env);
  const rs = await env.DB.prepare(`
    SELECT DISTINCT u.email
    FROM challenge_entries ce
    JOIN users u ON u.id = ce.user_id
    WHERE ce.challenge='worst'
  `).all();
  return (rs.results||[]).map(r=>r.email).filter(Boolean);
}


async function getActiveUserEmails(env){
  // Users who have at least one saved bracket
  await ensureUserSchema(env);
  const rs = await env.DB.prepare(`
    SELECT DISTINCT u.email
    FROM brackets b
    JOIN users u ON u.id = b.user_id
    WHERE u.email IS NOT NULL AND u.email!=''
  `).all().catch(()=>({results:[]}));
  return (rs.results||[]).map(r=>r.email).filter(Boolean);
}
async function milestoneFired(env, key){
  await ensureMilestones(env);
  const row = await env.DB.prepare("SELECT key FROM milestones WHERE key=?").bind(key).first();
  return !!row;
}

async function setMilestone(env, key){
  await ensureMilestones(env);
  const now = new Date().toISOString();
  await env.DB.prepare("INSERT INTO milestones (key, fired_at) VALUES (?,?) ON CONFLICT(key) DO NOTHING").bind(key, now).run();
}

async function sweet16IsSet(env){
  // Sweet 16 field determined when all Round-of-32 games (R1) winners exist: 4 per region = 16 total
  const rs = await env.DB.prepare(`
    SELECT
      SUM(CASE WHEN region='SOUTH' THEN 1 ELSE 0 END) as south,
      SUM(CASE WHEN region='EAST' THEN 1 ELSE 0 END) as east,
      SUM(CASE WHEN region='WEST' THEN 1 ELSE 0 END) as west,
      SUM(CASE WHEN region='MIDWEST' THEN 1 ELSE 0 END) as midwest
    FROM games
    WHERE id LIKE '%__R1__G%' AND winner_json IS NOT NULL AND winner_json!=''
  `).first();
  return rs && rs.south>=4 && rs.east>=4 && rs.west>=4 && rs.midwest>=4;
}

async function final4IsSet(env){
  // Final Four field determined when all Elite 8 games (R3) winners exist: 1 per region
  const rs = await env.DB.prepare(`
    SELECT COUNT(*) as c
    FROM games
    WHERE id LIKE '%__R3__G0' AND winner_json IS NOT NULL AND winner_json!=''
  `).first();
  return rs && Number(rs.c)>=4;
}

function siteLink(env, path){
  const domain = getSiteDomain(env);
  return `https://${domain}${path}`;
}

async function maybeSendWorstStageEmails(env){
  // Sweet 16 email: when Sweet 16 is set (Stage 2 unlocked)
  if(await sweet16IsSet(env)){
    const key='email_worst_stage2_sweet16';
    if(!(await milestoneFired(env, key))){
      const to = await getWorstParticipantEmails(env);
      if(to.length){
        const link = siteLink(env, "/?tab=worst"); // app routes handle; safe fallback
        const subject = "Sweet 16 is set — make your Worst Sweet 16 picks";
        const html = `
          <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.4">
            <h2>Sweet 16 is set.</h2>
            <p>Come back to Bracketology Builder to make your <b>Worst Sweet 16</b> loser picks and keep climbing the leaderboard.</p>
            <p><a href="${siteLink(env, "/?tab=worst&stage=r16")}">Make your picks now</a></p>
            <p style="color:#555">Worst is first around here.</p>
          </div>`;
        const text = `Sweet 16 is set. Make your Worst Sweet 16 loser picks: ${siteLink(env, "/?tab=worst&stage=r16")}`;
        try{ await sendResendEmail(env, to, subject, html, text); }catch(e){ /* don't block admin */ }
      }
      await setMilestone(env, key);
    }
  }

  // Final Four email: when Final Four is set (Stage 3 unlocked)
  if(await final4IsSet(env)){
    const key='email_worst_stage3_final4';
    if(!(await milestoneFired(env, key))){
      const to = await getWorstParticipantEmails(env);
      if(to.length){
        const subject = "Final Four is set — make your final Worst loser picks";
        const html = `
          <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.4">
            <h2>Final Four is set.</h2>
            <p>Your final Worst Bracket stage is live. Make your <b>Final Four</b> loser picks and see if you can finish in last place (the best place).</p>
            <p><a href="${siteLink(env, "/?tab=worst&stage=f4")}">Make your final picks now</a></p>
          </div>`;
        const text = `Final Four is set. Make your final Worst loser picks: ${siteLink(env, "/?tab=worst&stage=f4")}`;
        try{ await sendResendEmail(env, to, subject, html, text); }catch(e){}
      }
      await setMilestone(env, key);
    }
  }

  // Next-sports retention email around Final Four
  if(await final4IsSet(env)){
    const k2='email_nextsports_final4';
    if(!(await milestoneFired(env, k2))){
      const to = await getActiveUserEmails(env);
      if(to.length){
        const subject = 'Next up: NBA + NHL playoff brackets';
        const nba = siteLink(env, '/?tab=upcoming');
        const html = `
          <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.4">
            <h2>Don’t leave yet — NBA + NHL are next.</h2>
            <p>The NCAA Final Four is here. Keep the fun going with our upcoming playoff brackets:</p>
            <ul>
              <li><b>You Don’t Know Ball</b> — NBA Playoffs</li>
              <li><b>Biggest Benders</b> — NHL Playoffs</li>
              <li>Best NBA Playoff Bracket</li>
              <li>Best NHL Playoff Bracket</li>
            </ul>
            <p><a href="${nba}">See Upcoming Events</a></p>
          </div>`;
        const text = `Next up: NBA + NHL playoff brackets. See Upcoming Events: ${nba}`;
        try{ await sendResendEmail(env, to, subject, html, text); }catch(e){}
      }
      await setMilestone(env, k2);
    }
  }
}

export async function onRequestGet({ request, env }){
  const user = await requireUser({request, env});
  if(!isAdmin(user, env)) return json({ok:false, error:"Not authorized."}, 403);
  await ensureTables(env);
  await ensureGamesSchema(env);

  const url = new URL(request.url);
  const stage = url.searchParams.get("stage"); // optional
  const region = url.searchParams.get("region"); // optional

  let q = "SELECT * FROM games";
  const binds = [];
  const wh = [];
  if(stage){ wh.push("stage=?"); binds.push(stage); }
  if(region){ wh.push("region=?"); binds.push(region); }
  if(wh.length) q += " WHERE " + wh.join(" AND ");
  q += " ORDER BY stage, region, game_index";

  const rs = await env.DB.prepare(q).bind(...binds).all();
  return json({ok:true, games: rs.results||[]});
}

export async function onRequestPost({ request, env }){
  const user = await requireUser({request, env});
  if(!isAdmin(user, env)) return json({ok:false, error:"Not authorized."}, 403);
  await ensureTables(env);
  await ensureGamesSchema(env);

  const body = await request.json();
  const id = String(body.id||""); // recommended: "SOUTH__R0__G0"
  const stage = String(body.stage||"");
  const region = body.region ? String(body.region) : null;
  const game_index = Number.isFinite(body.game_index) ? body.game_index : null;
  const team1 = body.team1 || null;
  const team2 = body.team2 || null;
  const winner = body.winner || null;
  const score_total = (body.score_total===undefined || body.score_total===null || body.score_total==="") ? null : Number(body.score_total);

  if(!id || !stage || game_index===null) return json({ok:false, error:"Missing id, stage, or game_index."}, 400);

  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO games (id, stage, region, game_index, team1_json, team2_json, winner_json, updated_at, score_total)
    VALUES (?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      stage=excluded.stage,
      region=excluded.region,
      game_index=excluded.game_index,
      team1_json=excluded.team1_json,
      team2_json=excluded.team2_json,
      winner_json=excluded.winner_json,
      updated_at=excluded.updated_at
  `).bind(id, stage, region, game_index, team1?JSON.stringify(team1):null, team2?JSON.stringify(team2):null, winner?JSON.stringify(winner):null, now).run();

  // Trigger milestone emails (best-effort)
  try{ await maybeSendWorstStageEmails(env); }catch(e){}

  return json({ok:true});
}
