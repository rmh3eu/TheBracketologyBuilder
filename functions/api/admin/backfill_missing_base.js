
// Admin-only: backfill data.base for brackets missing it (transition era).
// Writes current projection snapshot (as of deploy) as the frozen Round of 64 base.
const SNAPSHOT = {
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
};

import { requireAdmin } from '../_util.js';

export async function onRequest(context) {
  const { request, env } = context;
  await requireAdmin(request, env);

  const db = env.DB;
  const rows = await db.prepare("SELECT id, data_json FROM brackets").all();
  let updated = 0;

  for (const r of rows.results) {
    try {
      const data = JSON.parse(r.data_json || "{}");
      if (!data.base) {
        data.base = SNAPSHOT;
        await db.prepare("UPDATE brackets SET data_json=? WHERE id=?")
          .bind(JSON.stringify(data), r.id).run();
        updated++;
      }
    } catch (e) {
      // skip bad rows
    }
  }

  return new Response(JSON.stringify({ ok: true, updated }), {
    headers: { "content-type": "application/json" }
  });
}
