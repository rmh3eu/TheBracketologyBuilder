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
    const fs = String(b.feature_status || '').toLowerCase();
    return !(fs === 'pending' || fs === 'approved');
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
      await api('/api/feature', { method:'POST', body: { bracket_id: bracketId, caption: '' } });
      setSubmitFeaturedMsg('Submitted! If approved, your bracket may appear on the site or TikTok.', true);
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
    a.href = `/?id=${encodeURIComponent(b.id)}`;

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

    // Featured badge (user-visible): show when submitted/approved.
    const fs = String(b.feature_status || '').toLowerCase();
    if (fs === 'approved' || fs === 'featured' || fs === 'pending') {
      const badge = document.createElement('span');
      badge.className = (fs === 'approved' || fs === 'featured') ? 'featuredBadge featuredBadgeApproved' : 'featuredBadge featuredBadgePending';
      badge.textContent = (fs === 'approved' || fs === 'featured') ? 'Featured' : 'Submitted';
      titleRow.appendChild(badge);
    }

    titleRow.insertBefore(title, titleRow.firstChild);

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
      hint.textContent = '🏀 Submit via dropdown above';
      a.appendChild(hint);
    }

    grid.appendChild(a);
  }
}


function reorderSections({ officialLive, sweet16Set }) {
  const main = document.getElementById('myBracketsMain');
  const secB = document.getElementById('secBracketology');
  const secO = document.getElementById('secOfficial');
  const secS = document.getElementById('secSecondChance');
  if (!main || !secB || !secO || !secS) return;

  // Ordering rules (brackets never disappear; only section order changes):
  // - Default (no toggles): Bracketology first.
  // - Official is always above Second Chance.
  // - When Official is live OR Sweet16 is set, Bracketology moves to the bottom.
  if (!officialLive && !sweet16Set) {
    // Bracketology, Official, Second Chance
    main.appendChild(secB);
    main.appendChild(secO);
    main.appendChild(secS);
    return;
  }

  // Either Official or Sweet16 is enabled:
  // Official, Second Chance, Bracketology
  main.appendChild(secO);
  main.appendChild(secS);
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
    const lower = (v) => String(v || '').toLowerCase();

    const secondChance = brackets.filter(b => lower(b.bracket_type) === 'second_chance');
    const official = brackets.filter(b => lower(b.bracket_type) === 'official');
    const bracketology = brackets.filter(b => {
      const t = lower(b.bracket_type);
      // Treat missing/unknown as bracketology for backward compatibility.
      return t === '' || t === 'bracketology' || (t !== 'official' && t !== 'second_chance');
    });

    // Always render Bracketology brackets somewhere (never disappear)
    renderBracketSection({ listId: 'projList', emptyId: 'projEmpty', items: bracketology });

    // Second Chance section: show saved brackets, but creation may be locked.
    if (sweet16Set) {
      renderBracketSection({ listId: 'scList', emptyId: 'scEmpty', items: secondChance });
    } else {
      renderBracketSection({ listId: 'scList', emptyId: 'scEmpty', items: secondChance });
      const scEmpty = document.getElementById('scEmpty');
      if (scEmpty && secondChance.length === 0) scEmpty.textContent = 'Second Chance Brackets unlock once the Sweet 16 is set.';
    }

    // Official section: show saved official brackets; if not live and none exist, show locked message.
    renderBracketSection({ listId: 'offList', emptyId: 'offEmpty', items: official });
    const offEmpty = document.getElementById('offEmpty');
    if (offEmpty && official.length === 0) {
      offEmpty.textContent = officialLive ? 'No official brackets yet.' : 'Official bracket is not live yet.';
    }

    // Reorder sections based on mode flags (Bracketology moves down when either is enabled)
    reorderSections({ officialLive, sweet16Set });
  } catch (e) {
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