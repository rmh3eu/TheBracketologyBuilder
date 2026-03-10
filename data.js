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
  [16, "LIU"],
];


const WEST = [
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
  [16, "Queens"],
];


const SOUTH = [
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
  [16, "UMBC"],
];


const MIDWEST = [
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
  [16, "Howard"],
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
