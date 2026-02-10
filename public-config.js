// Front-end helper for reading public site config.
// Used by pages that need feature flags / locks without bundling.
let __bbPublicConfigCache = null;

async function getPublicConfig(force=false) {
  if (!force && __bbPublicConfigCache) return __bbPublicConfigCache;
  try {
    const res = await fetch('/api/public-config', { headers: { 'accept': 'application/json' } });
    if (!res.ok) throw new Error('public-config ' + res.status);
    const data = await res.json();
    __bbPublicConfigCache = data || {};
    return __bbPublicConfigCache;
  } catch (e) {
    // Fail open (treat as unlocked / defaults) so UI still renders.
    __bbPublicConfigCache = {};
    return __bbPublicConfigCache;
  }
}

window.getPublicConfig = getPublicConfig;
