// My Brackets page script
// Simple + reliable: list brackets and route to bracket editor.

async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin'
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const err = new Error((data && data.error) || res.statusText || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}


function setSubmitFeaturedMsg(text, ok){
  const el = document.getElementById('submitFeaturedMsg');
  if(!el) return;
  el.className = 'submitFeaturedMsg ' + (ok ? 'ok' : 'err');
  el.textContent = text || '';
}

function initSubmitFeaturedToolbar(brackets){
  const bar = document.getElementById('submitFeaturedToolbar');
  const sel = document.getElementById('submitFeaturedSelect');
  const btn = document.getElementById('submitFeaturedBtn');
  if(!bar || !sel || !btn) return;

  const eligible = (brackets || []).filter(b=>{
    const fs = String(b.feature_status || '').toLowerCase().trim();
    // Exclude ANY bracket that has ever been submitted to featured (pending/approved/rejected/etc.)
    // feature_status comes from the feature_requests table. If it's non-empty, it's already in the pipeline.
    if (fs) return false;
    // Extra safety: if older rows set a boolean instead of feature_status
    if (b.is_featured || b.featured) return false;
    return true;
  });

  if(!eligible.length){
    bar.style.display = 'none';
    return;
  }

  // Populate select
  sel.innerHTML = '';
  for(const b of eligible){
    const opt = document.createElement('option');
    opt.value = b.id;
    const nm = (b.title && String(b.title).trim()) ? String(b.title).trim() :
      ((b.bracket_name && String(b.bracket_name).trim()) ? String(b.bracket_name).trim() : 'Untitled');
    opt.textContent = nm;
    sel.appendChild(opt);
  }

  bar.style.display = 'block';

  btn.addEventListener('click', async ()=>{
    const bracketId = sel.value;
    if(!bracketId) return;
    btn.disabled = true;
    setSubmitFeaturedMsg('', true);
    try{
      const selectedText = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].textContent : 'Your bracket';
      const choice = (window.featureBoostModal)
        ? await window.featureBoostModal(selectedText)
        : 'free';
      if(choice === 'cancel'){
        btn.disabled = false;
        return;
      }

      await api('/api/feature', { method:'POST', body: { bracket_id: bracketId, caption: '' } });

      if(choice === 'venmo'){
        if(window.venmoFeatureInfoModal) await window.venmoFeatureInfoModal(selectedText, '');
        setSubmitFeaturedMsg('Submitted. Venmo instructions shown for manual approval.', true);
      }else if(choice === 'paid5'){
        if(window.venmoFeatureInfoModal) await window.venmoFeatureInfoModal(selectedText, '$5');
        setSubmitFeaturedMsg('Submitted. Venmo instructions shown for manual approval.', true);
      }else if(choice === 'paid10'){
        if(window.venmoFeatureInfoModal) await window.venmoFeatureInfoModal(selectedText, '$10');
        setSubmitFeaturedMsg('Submitted. Venmo instructions shown for manual approval.', true);
      }else if(choice === 'paid20'){
        if(window.venmoFeatureInfoModal) await window.venmoFeatureInfoModal(selectedText, '$20');
        setSubmitFeaturedMsg('Submitted. Venmo instructions shown for manual approval.', true);
      }else{
        setSubmitFeaturedMsg('Submitted! If approved, your bracket may appear on the site or TikTok.', true);
      }

      // Remove option and hide if none left
      sel.querySelector('option[value="'+bracketId+'"]')?.remove();
      if(!sel.options.length){
        bar.style.display='none';
      }
    }catch(e){
      const msg = (e && e.message) ? e.message : 'Could not submit to featured.';
      setSubmitFeaturedMsg(msg, false);
    }finally{
      btn.disabled = false;
    }
  }, { once: true });
}

function formatUpdatedAt(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    // No seconds (cleaner + helps fit 2 cards per row on mobile)
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
}

function setAuthUI(me) {
  const authPill = document.getElementById('authPill');
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  const loggedIn = !!(me && me.user && me.user.user_id);

  if (authPill) {
    authPill.textContent = loggedIn ? `Signed in: ${me.user.email || me.user.user_id}` : 'Not signed in';
  }
  if (loginBtn) loginBtn.style.display = loggedIn ? 'none' : '';
  if (logoutBtn) logoutBtn.style.display = loggedIn ? '' : 'none';
}


function isSecondChanceBracketRecord(b){
  const normalizeType = (v) => String(v || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
  const t = normalizeType(b && b.bracket_type);
  if (t === 'second_chance' || t === 'secondchance') return true;

  try{
    const raw = b && b.data_json ? JSON.parse(b.data_json) : null;
    const picks = raw && raw.picks ? raw.picks : (raw || {});
    const getName = (v) => {
      if (!v) return '';
      if (typeof v === 'string') return v.trim();
      if (typeof v === 'object' && typeof v.name === 'string') return v.name.trim();
      return '';
    };
    const expected = {
      'REGION_EAST__R1__G0__winner': 'Duke',
      'REGION_EAST__R1__G1__winner': 'St Johns',
      'REGION_EAST__R1__G2__winner': 'Michigan St',
      'REGION_EAST__R1__G3__winner': 'UConn',
      'REGION_SOUTH__R1__G0__winner': 'Iowa',
      'REGION_SOUTH__R1__G1__winner': 'Nebraska',
      'REGION_SOUTH__R1__G2__winner': 'Illinois',
      'REGION_SOUTH__R1__G3__winner': 'Houston',
      'REGION_WEST__R1__G0__winner': 'Arizona',
      'REGION_WEST__R1__G1__winner': 'Arkansas',
      'REGION_WEST__R1__G2__winner': 'Texas/NC State',
      'REGION_WEST__R1__G3__winner': 'Purdue',
      'REGION_MIDWEST__R1__G0__winner': 'Michigan',
      'REGION_MIDWEST__R1__G1__winner': 'Alabama',
      'REGION_MIDWEST__R1__G2__winner': 'Tennessee',
      'REGION_MIDWEST__R1__G3__winner': 'Iowa St'
    };
    let matches = 0;
    for (const [k, v] of Object.entries(expected)) {
      if (getName(picks[k]) === v) matches += 1;
    }
    return matches >= 16;
  }catch(_e){
    return false;
  }
}

function renderBracketSection({ listId, emptyId, items }) {
  const grid = document.getElementById(listId);
  const empty = document.getElementById(emptyId);
  if (!grid) return;

  grid.innerHTML = '';
  const hasItems = Array.isArray(items) && items.length > 0;
  if (empty) empty.style.display = hasItems ? 'none' : '';
  if (!hasItems) return;

  for (const b of items) {
    const a = document.createElement('a');
    a.className = 'bracketCard';
    const isNba = String(b.sport || '').toLowerCase() === 'nba' || String(b.template_id || '').toLowerCase().startsWith('nba');
    a.href = isNba ? `nba.html?id=${encodeURIComponent(b.id)}` : `/?id=${encodeURIComponent(b.id)}`;

    const titleRow = document.createElement('div');
    titleRow.className = 'bracketTitleRow';

    const title = document.createElement('div');
    title.className = 'bracketTitle';
    const nmRaw = (b.title && String(b.title).trim())
      ? String(b.title).trim()
      : ((b.bracket_name && String(b.bracket_name).trim()) ? String(b.bracket_name).trim() : '');
    const isDefault =
      !nmRaw ||
      /^my bracket$/i.test(nmRaw) ||
      /^untitled bracket$/i.test(nmRaw) ||
      /^name your bracket here$/i.test(nmRaw) ||
      /^enter bracket name here$/i.test(nmRaw);
    title.textContent = isDefault ? 'Enter Bracket Name Here' : nmRaw;
    const emojiBits = [];
    if (Number(b.entered_best)) emojiBits.push('😇');
    if (Number(b.entered_worst)) emojiBits.push('😈');

    // Featured badge (user-visible): show when submitted/approved.
    const fs = String(b.feature_status || '').toLowerCase();
    if (fs === 'approved' || fs === 'featured' || fs === 'pending') {
      const badge = document.createElement('span');
      badge.className = (fs === 'approved' || fs === 'featured') ? 'featuredBadge featuredBadgeApproved' : 'featuredBadge featuredBadgePending';
      badge.textContent = (fs === 'approved' || fs === 'featured') ? 'Featured' : 'Submitted';
      titleRow.appendChild(badge);
    }

    titleRow.insertBefore(title, titleRow.firstChild);
    if (emojiBits.length) {
      const emoji = document.createElement('span');
      emoji.className = 'bracketChallengeIcons';
      emoji.textContent = emojiBits.join(' ');
      titleRow.appendChild(emoji);
    }

    const meta = document.createElement('div');
    meta.className = 'bracketMeta';
    meta.textContent = b.updated_at ? `Updated: ${formatUpdatedAt(b.updated_at)}` : '';

    a.appendChild(titleRow);
    a.appendChild(meta);

    // Submission is handled via the dropdown toolbar at top.
    // Keep cards clean and avoid duplicate UI paths.
    if (!(['approved','featured','pending','denied'].includes(fs))) {
      const hint = document.createElement('div');
      hint.className = 'submitFeaturedInlineHint';
      hint.textContent = '';
      a.appendChild(hint);
    }

    grid.appendChild(a);
  }
}


function reorderSections({ officialLive, sweet16Set }) {
  const main = document.getElementById('myBracketsMain');
  const secN = document.getElementById('secNBA');
  const secB = document.getElementById('secBracketology');
  const secO = document.getElementById('secOfficial');
  const secS = document.getElementById('secSecondChance');
  if (!main || !secB || !secO || !secS || !secN) return;

  if (!officialLive && !sweet16Set) {
    main.appendChild(secN);
    main.appendChild(secB);
    main.appendChild(secO);
    main.appendChild(secS);
    return;
  }
  main.appendChild(secN);
  main.appendChild(secS);
  main.appendChild(secO);
  main.appendChild(secB);
}



async function loadPage() {
  // Auth state
  let me = null;
  try {
    me = await api('/api/me');
    setAuthUI(me);
  } catch {
    setAuthUI(null);
  }

  // Public config controls whether we show all brackets under Bracketology vs Official.
  let cfg = {};
  try {
    cfg = (window.getPublicConfig) ? await window.getPublicConfig(true) : (await api('/api/public-config'));
  } catch {
    cfg = {};
  }
  const officialLive = !!cfg.official_bracket_live;
  const sweet16Set = !!cfg.sweet16_set;
  const scBtn = document.getElementById('createSecondChanceBtn');
  const scHint = document.getElementById('secondChanceHint');
  if (scBtn) scBtn.disabled = !sweet16Set;
  if (scHint) scHint.textContent = sweet16Set ? '' : 'Second Chance Brackets unlock once the Sweet 16 is set.';

  // Admin-only toggle (only your admin email has isAdmin=true)
  const adminWrap = document.getElementById('adminPhaseWrap');
  const toggle = document.getElementById('officialToggle');
  // Be tolerant to naming differences across builds/endpoints
  const isAdmin = !!(
    (me && me.user && (me.user.isAdmin || me.user.is_admin)) ||
    (me && (me.isAdmin || me.is_admin))
  );

  if (adminWrap) adminWrap.style.display = isAdmin ? 'flex' : 'none';
  if (toggle) {
    toggle.checked = officialLive;
    if (!toggle._wired) {
      toggle._wired = true;
      toggle.addEventListener('change', async () => {
        const val = toggle.checked ? 'true' : 'false';
        try {
          await api('/api/admin/settings', { method: 'POST', body: { key: 'official_bracket_live', value: val } });
          // re-render sections based on new phase
          await loadPage();
        } catch (e) {
          // revert UI if not authorized / failed
          try { toggle.checked = !toggle.checked; } catch {}
          alert((e && e.message) ? e.message : 'Could not update setting.');
        }
      });
    }
  }
  // Admin: Sweet 16 toggle (unlocks Second Chance Brackets)
  const sweetToggle = document.getElementById('sweet16Toggle');
  if (sweetToggle) {
    sweetToggle.checked = sweet16Set;
    if (!sweetToggle._wired) {
      sweetToggle._wired = true;
      sweetToggle.addEventListener('change', async () => {
        const val = sweetToggle.checked ? 'true' : 'false';
        try {
          await api('/api/admin/settings', { method: 'POST', body: { key: 'sweet16_set', value: val } });
          await loadPage();
        } catch (e) {
          try { sweetToggle.checked = !sweetToggle.checked; } catch {}
          alert((e && e.message) ? e.message : 'Could not update setting.');
        }
      });
    }
  }


  // Brackets list (all brackets for this user, regardless of day)
  try {
    const data = await api('/api/brackets');
    const brackets = Array.isArray(data?.brackets) ? data.brackets : [];

    // Safety: ensure featured brackets show as "Featured" here even if an older
    // bracket row doesn't surface feature_status on /api/brackets.
    // /api/featured is the public source of truth for what is actually featured.
    try {
      const feat = await api('/api/featured');
      if (feat?.ok && Array.isArray(feat.featured)) {
        const featuredSet = new Set(feat.featured.map(x => x.bracket_id));
        for (const b of brackets) {
          if (featuredSet.has(b.id)) b.feature_status = 'approved';
        }
      }
    } catch {}

    // Top submit-to-featured toolbar
    initSubmitFeaturedToolbar(brackets);


    // Split brackets by type
    const normalizeType = (v) => String(v || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
    const nba = [];
    const proj = [];
    const off = [];
    const sc = [];

    for (const b of brackets) {
      const type = normalizeType(b.bracket_type);
      const sport = String(b.sport || '').toLowerCase();
      const template = String(b.template_id || '').toLowerCase();
      if (sport === 'nba' || template.startsWith('nba')) {
        nba.push(b);
      } else if (isSecondChanceBracketRecord(b)) {
        sc.push(b);
      } else if (type === 'official') {
        off.push(b);
      } else {
        proj.push(b);
      }
    }

    renderBracketSection({ listId: 'nbaList', emptyId: 'nbaEmpty', items: nba });
    renderBracketSection({ listId: 'projList', emptyId: 'projEmpty', items: proj });
    renderBracketSection({ listId: 'offList', emptyId: 'offEmpty', items: off });
    renderBracketSection({ listId: 'scList', emptyId: 'scEmpty', items: sc });

    reorderSections({ officialLive, sweet16Set });
  } catch (e) {
    renderBracketSection({ listId: 'nbaList', emptyId: 'nbaEmpty', items: [] });
    renderBracketSection({ listId: 'projList', emptyId: 'projEmpty', items: [] });
    renderBracketSection({ listId: 'offList', emptyId: 'offEmpty', items: [] });
    renderBracketSection({ listId: 'scList', emptyId: 'scEmpty', items: [] });
    try { reorderSections({ officialLive, sweet16Set }); } catch {}
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const createNewBtn = document.getElementById('createNewBtn');
  const createNewRandomBtn = document.getElementById('createNewRandomBtn');
  const createSecondChanceBtn = document.getElementById('createSecondChanceBtn');
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  if (createNewBtn) {
    createNewBtn.addEventListener('click', async (ev) => {
      ev.preventDefault();

      // Decide which section this new bracket should belong to based on admin phase toggles.
      // Priority: Second Chance (Sweet16 set) > Official (Official live) > Bracketology (default).
      try {
        const cfg = await (window.getPublicConfig ? window.getPublicConfig() : api('/api/public-config'));
        const sweet16Set = !!(cfg && (cfg.sweet16_set || (cfg.config && cfg.config.sweet16_set)));

        try{ document.body.classList.toggle('sweet16Set', sweet16Set); }catch{}
        const officialLive = !!(cfg && (cfg.official_bracket_live || (cfg.config && cfg.config.official_bracket_live)));

        if (sweet16Set) {
          window.location.href = 'bracket.html?new=1&second=1';
          return;
        }
        if (officialLive) {
          window.location.href = 'bracket.html?new=1&official=1';
          return;
        }
      } catch {
        // fall through to default
      }

      window.location.href = 'bracket.html?new=1';
    });
  }
  
  if (createNewRandomBtn) {
    createNewRandomBtn.addEventListener('click', async (ev) => {
      ev.preventDefault();

      // IMPORTANT: ensure each click generates a unique URL so the bracket auto-random
      // logic (which uses sessionStorage keyed by location.search) runs every time.
      const nonce = Date.now();

      // Decide which section this new bracket should belong to based on admin phase toggles.
      // Priority: Second Chance (Sweet16 set) > Official (Official live) > Bracketology (default).
      try {
        const cfg = await (window.getPublicConfig ? window.getPublicConfig() : api('/api/public-config'));
        const sweet16Set = !!(cfg && (cfg.sweet16_set || (cfg.config && cfg.config.sweet16_set)));
        const officialLive = !!(cfg && (cfg.official_bracket_live || (cfg.config && cfg.config.official_bracket_live)));

        if (sweet16Set) {
          window.location.href = `bracket.html?new=1&second=1&random=1&nonce=${nonce}`;
          return;
        }
        if (officialLive) {
          window.location.href = `bracket.html?new=1&official=1&random=1&nonce=${nonce}`;
          return;
        }
      } catch {
        // fall through to default
      }

      window.location.href = `bracket.html?new=1&random=1&nonce=${nonce}`;
    });
  }



  if (createSecondChanceBtn) {
    createSecondChanceBtn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      try {
        const cfg = await (window.getPublicConfig ? window.getPublicConfig() : api('/api/public-config'));
        const sweet16Set = !!(cfg && (cfg.sweet16_set || (cfg.config && cfg.config.sweet16_set)));
        if (!sweet16Set) {
          alert('Second Chance Brackets unlock once the Sweet 16 is set.');
          return;
        }
      } catch {}
      window.location.href = 'bracket.html?new=1&second=1';
    });
  }

  if (loginBtn) {
    loginBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      window.location.href = 'login.html';
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      try {
        await api('/api/logout', { method: 'POST' });
      } catch {
        // ignore
      }
      window.location.reload();
    });
  }

  loadPage();
});