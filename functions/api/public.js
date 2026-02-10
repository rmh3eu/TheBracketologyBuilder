import { json } from "./_util.js";

export async function onRequestGet({ request, env }){
  const site_domain = env.SITE_DOMAIN || "bracketologybuilder.com";
  const site_name = env.SITE_NAME || "Bracketology Builder";
  const affiliate_join_url = env.AFFILIATE_JOIN_GROUP_URL || "";
  const group_upgrade_checkout_url_base = env.GROUP_UPGRADE_CHECKOUT_URL_BASE || "";
  // Pull optional public settings from D1 if available.
  let lock_enabled = false;
  let lock_at_iso = "";
  let banner_text = "";
  let official_bracket_live=false; let tournament_started=false; let sweet16_set=false; let sweet16_started=false;
  try{
    if (env.DB){
      const rows = await env.DB.prepare(
        "SELECT key, value_text FROM site_settings WHERE key IN ('lock_enabled','lock_at_iso','banner_text','official_bracket_live','tournament_started','sweet16_set','sweet16_started')"
      ).all();
      const map = Object.fromEntries((rows?.results||[]).map(r=>[r.key, r.value_text]));
      lock_enabled = (map.lock_enabled === 'true');
      lock_at_iso = map.lock_at_iso || "";
      banner_text = map.banner_text || "";
      official_bracket_live = (map.official_bracket_live==='true');
      tournament_started = (map.tournament_started==='true');
      sweet16_set = (map.sweet16_set==='true');
      sweet16_started = (map.sweet16_started==='true');
    }
  }catch(e){ /* ignore */ }

  return json({
    ok:true,
    site_domain,
    site_name,
    affiliate_join_url,
    group_upgrade_checkout_url_base,
    lock_enabled,
    lock_at_iso,
    banner_text,
    official_bracket_live,
    tournament_started,
    sweet16_set,
    sweet16_started
  });
}
