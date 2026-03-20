import { json } from "./_util.js";

const GAMES = [{"id": "SOUTH__R0__G2", "winner": {"name": "Vanderbilt"}}, {"id": "SOUTH__R0__G3", "winner": {"name": "Nebraska"}}, {"id": "SOUTH__R0__G4", "winner": {"name": "VCU"}}, {"id": "SOUTH__R0__G6", "winner": {"name": "Texas A&M"}}, {"id": "WEST__R0__G2", "winner": {"name": "High Point"}}, {"id": "WEST__R0__G3", "winner": {"name": "Arkansas"}}, {"id": "WEST__R0__G4", "winner": {"name": "Texas/NC State"}}, {"id": "EAST__R0__G0", "winner": {"name": "Duke"}}, {"id": "EAST__R0__G1", "winner": {"name": "TCU"}}, {"id": "EAST__R0__G4", "winner": {"name": "Louisville"}}, {"id": "EAST__R0__G5", "winner": {"name": "Michigan St"}}, {"id": "MIDWEST__R0__G0", "winner": {"name": "Michigan"}}];

export async function onRequestGet() {
  return json({ ok:true, games: GAMES });
}
