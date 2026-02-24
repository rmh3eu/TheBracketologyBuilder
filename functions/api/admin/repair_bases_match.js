
import { json, requireUser, isAdmin } from "../_util.js";

// Two known projection snapshots (legacy + current).
const SNAPSHOTS = [
  { name: "legacy_v36_39", base: {
  "EAST": [
    [
      1,
      "Duke"
    ],
    [
      2,
      "Nebraska"
    ],
    [
      3,
      "Michigan St"
    ],
    [
      4,
      "Texas Tech"
    ],
    [
      5,
      "Alabama"
    ],
    [
      6,
      "St. John's"
    ],
    [
      7,
      "Kentucky"
    ],
    [
      8,
      "Texas A&M"
    ],
    [
      9,
      "Utah St"
    ],
    [
      10,
      "Indiana"
    ],
    [
      11,
      "New Mexico"
    ],
    [
      12,
      "Belmont"
    ],
    [
      13,
      "High Point"
    ],
    [
      14,
      "Troy"
    ],
    [
      15,
      "Portland St"
    ],
    [
      16,
      "Merrimack"
    ]
  ],
  "WEST": [
    [
      1,
      "Arizona"
    ],
    [
      2,
      "Illinois"
    ],
    [
      3,
      "Gonzaga"
    ],
    [
      4,
      "Kansas"
    ],
    [
      5,
      "Virginia"
    ],
    [
      6,
      "North Carolina"
    ],
    [
      7,
      "Saint Louis"
    ],
    [
      8,
      "Villanova"
    ],
    [
      9,
      "NC St"
    ],
    [
      10,
      "St. Mary's"
    ],
    [
      11,
      "UCLA"
    ],
    [
      12,
      "Tulsa"
    ],
    [
      13,
      "SF Austin"
    ],
    [
      14,
      "Hawaii"
    ],
    [
      15,
      "Wright St"
    ],
    [
      16,
      "Navy"
    ]
  ],
  "MIDWEST": [
    [
      1,
      "Michigan"
    ],
    [
      2,
      "Iowa St"
    ],
    [
      3,
      "Purdue"
    ],
    [
      4,
      "Florida"
    ],
    [
      5,
      "Tennessee"
    ],
    [
      6,
      "Louisville"
    ],
    [
      7,
      "Auburn"
    ],
    [
      8,
      "Iowa"
    ],
    [
      9,
      "Wisconsin"
    ],
    [
      10,
      "USC"
    ],
    [
      11,
      "Ohio St"
    ],
    [
      12,
      "Liberty"
    ],
    [
      13,
      "Utah Valley"
    ],
    [
      14,
      "N Dakota St"
    ],
    [
      15,
      "Austin Peay"
    ],
    [
      16,
      "Long Island"
    ]
  ],
  "SOUTH": [
    [
      1,
      "UConn"
    ],
    [
      2,
      "Houston"
    ],
    [
      3,
      "Vanderbilt"
    ],
    [
      4,
      "BYU"
    ],
    [
      5,
      "Arkansas"
    ],
    [
      6,
      "Clemson"
    ],
    [
      7,
      "UCF"
    ],
    [
      8,
      "SMU"
    ],
    [
      9,
      "Georgia"
    ],
    [
      10,
      "Miami (FLA.)"
    ],
    [
      11,
      "Virginia Tech"
    ],
    [
      12,
      "Yale"
    ],
    [
      13,
      "UNC-Wilmington"
    ],
    [
      14,
      "ETSU"
    ],
    [
      15,
      "UT Martin"
    ],
    [
      16,
      "B-CU"
    ]
  ]
} },
  { name: "current", base: {
  "EAST": [
    [
      1,
      "Duke"
    ],
    [
      2,
      "Purdue"
    ],
    [
      3,
      "Nebraska"
    ],
    [
      4,
      "Michigan St"
    ],
    [
      5,
      "Alabama"
    ],
    [
      6,
      "Wisconsin"
    ],
    [
      7,
      "Villanova"
    ],
    [
      8,
      "Miami FLA"
    ],
    [
      9,
      "Texas A&M"
    ],
    [
      10,
      "Clemson"
    ],
    [
      11,
      "Missouri"
    ],
    [
      12,
      "High Point"
    ],
    [
      13,
      "Liberty"
    ],
    [
      14,
      "Navy"
    ],
    [
      15,
      "Merrimack"
    ],
    [
      16,
      "LIU"
    ]
  ],
  "WEST": [
    [
      1,
      "Arizona"
    ],
    [
      2,
      "Florida"
    ],
    [
      3,
      "Virginia"
    ],
    [
      4,
      "Kansas"
    ],
    [
      5,
      "North Carolina"
    ],
    [
      6,
      "Vanderbilt"
    ],
    [
      7,
      "Saint Mary's"
    ],
    [
      8,
      "Utah State"
    ],
    [
      9,
      "Iowa"
    ],
    [
      10,
      "UCLA"
    ],
    [
      11,
      "New Mexico"
    ],
    [
      12,
      "Belmont"
    ],
    [
      13,
      "Utah Valley"
    ],
    [
      14,
      "ETSU"
    ],
    [
      15,
      "Wright State"
    ],
    [
      16,
      "App St"
    ]
  ],
  "MIDWEST": [
    [
      1,
      "Michigan"
    ],
    [
      2,
      "UConn"
    ],
    [
      3,
      "Illinois"
    ],
    [
      4,
      "St. John's"
    ],
    [
      5,
      "BYU"
    ],
    [
      6,
      "Louisville"
    ],
    [
      7,
      "Saint Louis"
    ],
    [
      8,
      "NC State"
    ],
    [
      9,
      "UCF"
    ],
    [
      10,
      "Texas"
    ],
    [
      11,
      "Santa Clara"
    ],
    [
      12,
      "Yale"
    ],
    [
      13,
      "SF Austin"
    ],
    [
      14,
      "N Dakota St"
    ],
    [
      15,
      "Austin Peay"
    ],
    [
      16,
      "Howard"
    ]
  ],
  "SOUTH": [
    [
      1,
      "Iowa State"
    ],
    [
      2,
      "Houston"
    ],
    [
      3,
      "Gonzaga"
    ],
    [
      4,
      "Texas Tech"
    ],
    [
      5,
      "Arkansas"
    ],
    [
      6,
      "Tennessee"
    ],
    [
      7,
      "Miami (OH)"
    ],
    [
      8,
      "SMU"
    ],
    [
      9,
      "Georgia"
    ],
    [
      10,
      "Auburn"
    ],
    [
      11,
      "Ohio State"
    ],
    [
      12,
      "USF"
    ],
    [
      13,
      "UNCW"
    ],
    [
      14,
      "UC Irvine"
    ],
    [
      15,
      "Portland State"
    ],
    [
      16,
      "UMBC"
    ]
  ]
} }
];

const TEAM_SETS = SNAPSHOTS.map(s=>({
  name: s.name,
  base: s.base,
  teams: new Set(Object.values(s.base).flat().map(x=>x[1]))
}));

function scoreData(dataJsonStr, teamSet){
  let score = 0;
  for (const t of teamSet) {
    if (dataJsonStr.includes('"' + t + '"') || dataJsonStr.includes(t)) score++;
  }
  return score;
}

export async function onRequest({ request, env }) {
  const user = await requireUser({ request, env });
  if(!user) return json({ ok:false, error:"Not logged in." }, 401);
  if(!(await isAdmin(user, env))) return json({ ok:false, error:"Not authorized." }, 403);

  const url = new URL(request.url);
  const dry = url.searchParams.get("dry") === "1";
  const limit = Math.min(5000, Math.max(1, parseInt(url.searchParams.get("limit") || "5000", 10)));
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));

  const rows = await env.DB.prepare(
    "SELECT id, data_json FROM brackets LIMIT ? OFFSET ?"
  ).bind(limit, offset).all();

  let updated = 0;
  const samples = [];

  for (const r of (rows.results || [])) {
    let dataStr = r.data_json || "{}";
    let dataObj = null;
    try{ dataObj = JSON.parse(dataStr); }catch(e){ dataObj = {}; }
    if (dataObj && dataObj.base) continue; // already frozen, don't touch

    // choose best snapshot by overlap with stored picks
    let best = TEAM_SETS[0];
    let bestScore = scoreData(dataStr, best.teams);
    for (let i=1;i<TEAM_SETS.length;i++) {
      const sc = scoreData(dataStr, TEAM_SETS[i].teams);
      if (sc > bestScore) { best = TEAM_SETS[i]; bestScore = sc; }
    }

    // If score is extremely low, skip (avoid random assignment)
    if (bestScore < 3) continue;

    dataObj.base = best.base;
    updated++;
    if (samples.length < 10) samples.push({ id: r.id, snapshot: best.name, score: bestScore });

    if (!dry) {
      await env.DB.prepare("UPDATE brackets SET data_json=? WHERE id=?")
        .bind(JSON.stringify(dataObj), r.id).run();
    }
  }

  return json({ ok:true, dry, limit, offset, updated, samples });
}
