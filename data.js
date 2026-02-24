// v23 SIMPLE EDITOR MODE (AUTO-FILLED)
// Edit team names below. Keep the seed numbers the same.

const LAST_FOUR_IN = [
  "Virginia Tech",
  "New Mexico",
  "Texas",
  "USC"
];
const FIRST_FOUR_OUT = [
  "TCU",
  "Seton Hall",
  "Indiana",
  "Santa Clara"
];

const EAST = [
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
];
const WEST = [
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
];
const SOUTH = [
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
];
const MIDWEST = [
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
];

const GENERATED_AT = new Date().toISOString();


// Attach to window for non-module use
window.BRACKET_DATA = window.BRACKET_DATA || {};
window.BRACKET_DATA.LAST_FOUR_IN = LAST_FOUR_IN;
window.BRACKET_DATA.FIRST_FOUR_OUT = FIRST_FOUR_OUT;
window.BRACKET_DATA.EAST = EAST;
window.BRACKET_DATA.WEST = WEST;
window.BRACKET_DATA.SOUTH = SOUTH;
window.BRACKET_DATA.MIDWEST = MIDWEST;
window.BRACKET_DATA.GENERATED_AT = GENERATED_AT;


// v37.1: editable seasonal banner text (shown above Bubble section)
const SEASON_BANNER_TEXT = 'It’s College Basketball Season! 🏀 Time to Make a Bracket!';


// === R64 SNAPSHOT (used for existing brackets) ===
const R64_SNAPSHOT = {
  EAST: EAST,
  WEST: WEST,
  MIDWEST: MIDWEST,
  SOUTH: SOUTH
};
