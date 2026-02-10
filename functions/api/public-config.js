import { json } from "./_util.js";

export async function onRequestGet({ request, env }){
  // Public config: flags used by the frontend to gate features.
  let official_bracket_live = false;
  let tournament_started = false;
  let sweet16_set = false;
  let sweet16_started = false;

  try{
    if(env.DB){
      const rs = await env.DB.prepare(
        "SELECT key, value_text FROM site_settings WHERE key IN ('official_bracket_live','tournament_started','sweet16_set','sweet16_started')"
      ).all();
      const map = Object.fromEntries((rs?.results||[]).map(r=>[r.key, r.value_text]));
      official_bracket_live = (map.official_bracket_live === 'true');
      tournament_started = (map.tournament_started === 'true');
      sweet16_set = (map.sweet16_set === 'true');
      sweet16_started = (map.sweet16_started === 'true');
    }
  }catch(_e){ /* ignore */ }

  return json({ ok:true, official_bracket_live, tournament_started, sweet16_set, sweet16_started });
}
