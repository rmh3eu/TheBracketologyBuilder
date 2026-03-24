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
  [1, "Duke"],
  [2, "UConn"],
  [3, "Michigan St"],
  [4, "Kansas"],
  [5, "St Johns"],
  [6, "Louisville"],
  [7, "UCLA"],
  [8, "Ohio St"],
  [9, "TCU"],
  [10, "UCF"],
  [11, "USF"],
  [12, "UNI"],
  [13, "Cal Baptist"],
  [14, "N Dakota St"],
  [15, "Furman"],
  [16, "Siena"],
];


const WEST = [
  [1, "Arizona"],
  [2, "Purdue"],
  [3, "Wisconsin"],
  [4, "Arkansas"],
  [5, "Wisconsin"],
  [6, "BYU"],
  [7, "Miami (FL)"],
  [8, "Villanova"],
  [9, "Utah St"],
  [10, "Missouri"],
  [11, "Texas/NC State"],
  [12, "High Point"],
  [13, "Hawaii"],
  [14, "Kennesaw St"],
  [15, "Queens"],
  [16, "LIU"],
];


const SOUTH = [
  [1, "Florida"],
  [2, "Houston"],
  [3, "Illinois"],
  [4, "Nebraska"],
  [5, "Vanderbilt"],
  [6, "North Carolina"],
  [7, "Saint Mary’s"],
  [8, "Clemson"],
  [9, "Iowa"],
  [10, "Texas A&M"],
  [11, "VCU"],
  [12, "McNeese"],
  [13, "Troy"],
  [14, "Penn"],
  [15, "Idaho"],
  [16, "Lehigh/Prairie View"],
];


const MIDWEST = [
  [1, "Michigan"],
  [2, "Iowa St"],
  [3, "Virginia"],
  [4, "Alabama"],
  [5, "Texas Tech"],
  [6, "Tennessee"],
  [7, "Kentucky"],
  [8, "Georgia"],
  [9, "Saint Louis"],
  [10, "Santa Clara"],
  [11, "SMU/Miami (OH)"],
  [12, "Akron"],
  [13, "Hofstra"],
  [14, "Wright St"],
  [15, "Tennessee St"],
  [16, "UMBC/Howard"],
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
