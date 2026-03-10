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
  [16, "LIU"],
];


const WEST = [
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
  [16, "App St"],
];


const SOUTH = [
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
  [16, "UMBC"],
];


const MIDWEST = [
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
