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

// BASE VERSION SYSTEM
// ------------------------------------------------------------------
// Rule:
// - Base 1 is the current frozen dataset.
// - Future projection updates must ADD Base 2, Base 3, etc.
// - Never overwrite Base 1 when new team data arrives.
// - Homepage / new brackets should always use the HIGHEST base version.
// - Existing saved brackets must remain tied to the base they were created with.
// ------------------------------------------------------------------

const PROJECTION_BASES = {
  1: {
    EAST: [
      [1, "Duke"],
      [2, "Gonzaga"],
      [3, "Nebraska"],
      [4, "Michigan St"],
      [5, "St Johns"],
      [6, "Louisville"],
      [7, "Kentucky"],
      [8, "NC State"],
      [9, "Texas A&M"],
      [10, "Clemson"],
      [11, "Texas"],
      [12, "High Point"],
      [13, "Liberty"],
      [14, "Navy"],
      [15, "Merrimack"],
      [16, "LIU"]
    ],
    WEST: [
      [1, "Arizona"],
      [2, "Houston"],
      [3, "Virginia"],
      [4, "Kansas"],
      [5, "North Carolina"],
      [6, "Wisconsin"],
      [7, "Villanova"],
      [8, "Utah State"],
      [9, "Iowa"],
      [10, "UCLA"],
      [11, "Missouri"],
      [12, "Belmont"],
      [13, "Utah Valley"],
      [14, "ETSU"],
      [15, "Wright State"],
      [16, "App St"]
    ],
    MIDWEST: [
      [1, "Michigan"],
      [2, "Florida"],
      [3, "Illinois"],
      [4, "Alabama"],
      [5, "Arkansas"],
      [6, "Vanderbilt"],
      [7, "Saint Louis"],
      [8, "Miami"],
      [9, "UCF"],
      [10, "Georgia"],
      [11, "Santa Clara"],
      [12, "Yale"],
      [13, "SF Austin"],
      [14, "N Dakota St"],
      [15, "Austin Peay"],
      [16, "Howard"]
    ],
    SOUTH: [
      [1, "Iowa State"],
      [2, "UConn"],
      [3, "Purdue"],
      [4, "Texas Tech"],
      [5, "BYU"],
      [6, "Tennessee"],
      [7, "Miami Ohio"],
      [8, "SMU"],
      [9, "Saint Marys"],
      [10, "Auburn"],
      [11, "New Mexico"],
      [12, "USF"],
      [13, "UNCW"],
      [14, "UC Irvine"],
      [15, "Portland State"],
      [16, "UMBC"]
    ],
  },
  2: {
    EAST: [
      [1, "Duke"],
      [2, "Michigan St"],
      [3, "Virginia"],
      [4, "St Johns"],
      [5, "Arkansas"],
      [6, "Wisconsin"],
      [7, "Saint Mary’s"],
      [8, "Saint Louis"],
      [9, "Kentucky"],
      [10, "UCF"],
      [11, "Santa Clara"],
      [12, "High Point"],
      [13, "Liberty"],
      [14, "Tennessee St"],
      [15, "Merrimack"],
      [16, "LIU"]
    ],
    WEST: [
      [1, "Arizona"],
      [2, "Iowa State"],
      [3, "Gonzaga"],
      [4, "Kansas"],
      [5, "Purdue"],
      [6, "Tennessee"],
      [7, "Miami FLA"],
      [8, "Villanova"],
      [9, "Ohio State"],
      [10, "Texas"],
      [11, "USF"],
      [12, "Utah Valley"],
      [13, "N Dakota St"],
      [14, "Portland St"],
      [15, "Wright St"],
      [16, "Queens"]
    ],
    MIDWEST: [
      [1, "Michigan"],
      [2, "UConn"],
      [3, "Nebraska"],
      [4, "Alabama"],
      [5, "North Carolina"],
      [6, "Miami Ohio"],
      [7, "TCU"],
      [8, "Georgia"],
      [9, "Clemson"],
      [10, "Iowa"],
      [11, "Missouri"],
      [12, "Yale"],
      [13, "SF Austin"],
      [14, "Troy"],
      [15, "Furman"],
      [16, "Howard"]
    ],
    SOUTH: [
      [1, "Florida"],
      [2, "Houston"],
      [3, "Illinois"],
      [4, "Texas Tech"],
      [5, "Vanderbilt"],
      [6, "Louisville"],
      [7, "BYU"],
      [8, "UCLA"],
      [9, "Utah State"],
      [10, "NC State"],
      [11, "Texas A&M"],
      [12, "N. Iowa"],
      [13, "Hofstra"],
      [14, "UC Irvine"],
      [15, "Boston U"],
      [16, "UMBC"]
    ],
  }
};

const CURRENT_BASE_VERSION = 2;

function getCurrentProjectionBase() {
  return PROJECTION_BASES[CURRENT_BASE_VERSION];
}

const CURRENT_BASE = getCurrentProjectionBase();


// Derived current projection arrays used by the rest of the app.
// These stay backward-compatible with the existing codebase.
const EAST = CURRENT_BASE.EAST;
const WEST = CURRENT_BASE.WEST;
const MIDWEST = CURRENT_BASE.MIDWEST;
const SOUTH = CURRENT_BASE.SOUTH;



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


// Expose projection version info for future tools / debugging.
try {
  window.PROJECTION_BASES = PROJECTION_BASES;
  window.CURRENT_BASE_VERSION = CURRENT_BASE_VERSION;
} catch (_e) {}
