
function setSeasonBar(){
  const bar = document.getElementById('seasonBar');
  if(!bar) return;
  const textEl = document.getElementById('seasonText') || bar;
  const editBtn = document.getElementById('seasonEditBtn');
  const lockBtn = document.getElementById('lockEditBtn');
  const lockStatus = document.getElementById('lockStatus');

  // Default (can be overridden by /api/public banner_text)
  const fallback = (typeof SEASON_BANNER_TEXT !== 'undefined' && SEASON_BANNER_TEXT)
    ? SEASON_BANNER_TEXT
    : 'It’s College Basketball Season! 🏀 Time to Make a Bracket!';
  const txt = (PUBLIC_CONFIG && typeof PUBLIC_CONFIG.banner_text === 'string' && PUBLIC_CONFIG.banner_text.trim())
    ? PUBLIC_CONFIG.banner_text.trim()
    : fallback;

  textEl.textContent = txt;

  const isAdm = !!(state && state.me && state.me.isAdmin);

  // Admin-only quick edit for banner
  if(editBtn){
    editBtn.style.display = isAdm ? '' : 'none';
    if(isAdm && !editBtn._wired){
      editBtn._wired = true;
      editBtn.addEventListener('click', ()=>openSeasonBannerModal(txt));
    }
  }

  // Admin-only lock controls + status
  if(lockBtn){
    lockBtn.style.display = isAdm ? '' : 'none';
    if(isAdm && !lockBtn._wired){
      lockBtn._wired = true;
      lockBtn.addEventListener('click', ()=>openLockModal());
    }
  }
  if(lockStatus){
    if(!PUBLIC_CONFIG || !PUBLIC_CONFIG.lock_enabled){
      lockStatus.className = 'lockStatus unlocked';
      lockStatus.textContent = 'Unlocked';
      lockStatus.style.display = isAdm ? '' : 'none';
      return;
    }
    const ms = (PUBLIC_CONFIG.lock_at_iso) ? Date.parse(PUBLIC_CONFIG.lock_at_iso) : NaN;
    const now = Date.now();
    if(Number.isNaN(ms)){
      lockStatus.className = 'lockStatus scheduled';
      lockStatus.textContent = 'Lock scheduled';
      lockStatus.style.display = isAdm ? '' : 'none';
      return;
    }
    const dt = new Date(ms);
    const when = dt.toLocaleString();
    if(now >= ms){
      lockStatus.className = 'lockStatus locked';
      lockStatus.textContent = 'Locked';
    }else{
      lockStatus.className = 'lockStatus scheduled';
      lockStatus.textContent = 'Locks at ' + when;
    }
    lockStatus.style.display = isAdm ? '' : 'none';
  }
}

function openSeasonBannerModal(currentText){
  if(!(state && state.me && state.me.isAdmin)) return;
  const overlay = document.createElement('div');
  overlay.className = 'modalOverlay';
  overlay.innerHTML = `
    <div class="modalCard">
      <div class="modalTitle">Edit season banner</div>
      <div class="modalBody">
        <div class="smallMuted" style="margin-bottom:8px;">Shown above the Bubble section. Example: “It’s NBA Season! 🏀 Time to Make a Bracket!”</div>
        <input id="seasonBannerInput" class="input" type="text" value="${escapeAttr(currentText||'')}" />
        <div class="row" style="margin-top:12px; gap:10px;">
          <button class="btnPrimary" id="seasonBannerSaveBtn">Save</button>
          <button class="btnGhost" id="seasonBannerCancelBtn">Cancel</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = ()=>{ try{ overlay.remove(); }catch(e){} };
  overlay.addEventListener('click', (e)=>{ if(e.target===overlay) close(); });
  qs('#seasonBannerCancelBtn', overlay).onclick = close;
  qs('#seasonBannerSaveBtn', overlay).onclick = async ()=>{
    const inp = qs('#seasonBannerInput', overlay);
    const val = (inp && inp.value) ? String(inp.value).trim() : '';
    try{
      await api('/api/admin/settings', {
        method:'POST',
        body: JSON.stringify({ key:'banner_text', value: val })
      });
      if(!PUBLIC_CONFIG) PUBLIC_CONFIG = {};
      PUBLIC_CONFIG.banner_text = val;
      setSeasonBar();
      close();
      toast('Banner updated.');
    }catch(err){
      toast(err?.message || 'Could not save banner.');
    }
  };
}


async function adminSetSetting(key, value){
  try{
    await api('/api/admin/settings', {
      method:'POST',
      headers:{'content-type':'application/json'},
      body: JSON.stringify({ key, value })
    });
    // Refresh public config so UI updates instantly
    PUBLIC_CONFIG = null;
    LOCK_AT_MS = null;
    await loadPublicConfig();
    setSeasonBar();
  }catch(e){
    toast('Could not save setting.');
  }
}

function openLockModal(){
  if(!(state && state.me && state.me.isAdmin)) return;
  const curEnabled = !!(PUBLIC_CONFIG && PUBLIC_CONFIG.lock_enabled);
  const curIso = (PUBLIC_CONFIG && PUBLIC_CONFIG.lock_at_iso) ? String(PUBLIC_CONFIG.lock_at_iso) : '';
  const curMs = curIso ? Date.parse(curIso) : NaN;

  const overlay = document.createElement('div');
  overlay.className = 'modalOverlay';

  // Build initial datetime-local value (local time)
  let dtLocal = '';
  if(!Number.isNaN(curMs)){
    const d = new Date(curMs);
    const pad = (n)=>String(n).padStart(2,'0');
    dtLocal = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  overlay.innerHTML = `
    <div class="modalCard">
      <div class="modalTitle">Bracket Lock Controls</div>
      <div class="modalBody">
        <div class="smallNote">When locked, all picks and edits are blocked across Home, My Brackets, and Challenges.</div>
        <div style="height:10px"></div>
        <div class="formRow">
          <label class="label">Status</label>
          <div class="pillRow">
            <span class="pill ${curEnabled ? 'pillOn' : 'pillOff'}">${curEnabled ? 'Enabled' : 'Disabled'}</span>
            <span class="pill ${(!Number.isNaN(curMs) && Date.now()>=curMs && curEnabled) ? 'pillLock' : 'pillInfo'}">${
              (!curEnabled) ? 'Unlocked' :
              (Number.isNaN(curMs)) ? 'Lock time not set' :
              (Date.now()>=curMs) ? 'Locked' : ('Locks at ' + new Date(curMs).toLocaleString())
            }</span>
          </div>
        </div>

        <div style="height:10px"></div>
        <div class="formRow">
          <label class="label" for="lockAtInput">Lock at (local time)</label>
          <input id="lockAtInput" class="input" type="datetime-local" value="${dtLocal}">
          <div class="smallNote">Set a time in your local timezone. You can also lock immediately.</div>
        </div>
      </div>
      <div class="modalActions">
        <button id="lockNowBtn" class="btn danger">Lock now</button>
        <button id="lockScheduleBtn" class="btn">Schedule lock</button>
        <button id="unlockBtn" class="btn ghost">Unlock</button>
        <button id="closeLockModal" class="btn ghost">Close</button>
      </div>
    </div>
  `;

  overlay.addEventListener('click', (e)=>{ if(e.target===overlay) overlay.remove(); });
  document.body.appendChild(overlay);

  const close = ()=>overlay.remove();

  qs('#closeLockModal', overlay).addEventListener('click', close);

  qs('#unlockBtn', overlay).addEventListener('click', async ()=>{
    await adminSetSetting('lock_enabled','false');
    await adminSetSetting('lock_at_iso','');
    toast('Unlocked.');
    close();
  });

  qs('#lockNowBtn', overlay).addEventListener('click', async ()=>{
    const nowIso = new Date().toISOString();
    await adminSetSetting('lock_enabled','true');
    await adminSetSetting('lock_at_iso', nowIso);
    toast('Locked.');
    close();
  });

  qs('#lockScheduleBtn', overlay).addEventListener('click', async ()=>{
    const v = qs('#lockAtInput', overlay).value;
    if(!v){
      toast('Pick a lock time first.');
      return;
    }
    const ms = Date.parse(v);
    if(Number.isNaN(ms)){
      toast('Invalid time.');
      return;
    }
    const iso = new Date(ms).toISOString();
    await adminSetSetting('lock_enabled','true');
    await adminSetSetting('lock_at_iso', iso);
    toast('Lock scheduled.');
    close();
  });
}



// Data is defined in data.js as top-level consts (EAST/WEST/SOUTH/MIDWEST, LAST_FOUR_IN, FIRST_FOUR_OUT, etc.).
// In classic-script mode (Safari), do NOT redeclare those same names here.
// Instead, read them (or fall back to window.BRACKET_DATA if present).
const BRACKET_DATA = window.BRACKET_DATA || {};
const REGION_EAST = (typeof EAST !== 'undefined') ? EAST : (BRACKET_DATA.EAST||[]);
const REGION_WEST = (typeof WEST !== 'undefined') ? WEST : (BRACKET_DATA.WEST||[]);
const REGION_SOUTH = (typeof SOUTH !== 'undefined') ? SOUTH : (BRACKET_DATA.SOUTH||[]);
const REGION_MIDWEST = (typeof MIDWEST !== 'undefined') ? MIDWEST : (BRACKET_DATA.MIDWEST||[]);
const LAST_FOUR_IN_LIST = (typeof LAST_FOUR_IN !== 'undefined') ? LAST_FOUR_IN : (BRACKET_DATA.LAST_FOUR_IN||[]);
const FIRST_FOUR_OUT_LIST = (typeof FIRST_FOUR_OUT !== 'undefined') ? FIRST_FOUR_OUT : (BRACKET_DATA.FIRST_FOUR_OUT||[]);
const GENERATED_AT_VALUE = (typeof GENERATED_AT !== 'undefined') ? GENERATED_AT : (BRACKET_DATA.GENERATED_AT||null);
/**
 * BracketologyBuilder v30
 * - Guest users can fill a bracket (saved locally)
 * - When champion is picked, prompt to create/sign-in to save to account
 * - Logged-in users: picks auto-save to D1 (DB) via /api/bracket PUT/ /api/brackets POST
 * - Admin: /api/admin/emails export (locked to ADMIN_EMAIL)
 */


function promptBracketTitle(defaultTitle){
  const t = prompt('Name this bracket:', defaultTitle || '');
  if(t===null) return null;
  const name = String(t).trim();
  if(!name){ toast('Please enter a bracket name.'); return null; }
  return name.slice(0,80);
}

// -------------------- Utilities --------------------
// Whether the official bracket is set (Selection Sunday). This is fetched from /api/public-config.
let OFFICIAL_BRACKET_LIVE = false;

async function loadPublicConfig(){
  try{
    const r = await fetch('/api/public-config', { cache: 'no-store' });
    if(!r.ok) return;
    const cfg = await r.json();
    if(typeof cfg?.official_bracket_live === 'boolean'){
      OFFICIAL_BRACKET_LIVE = cfg.official_bracket_live;
    }
    // If the official bracket is live, attempt to dispatch any queued reminder emails.
    if(OFFICIAL_BRACKET_LIVE) maybeDispatchReminderEmails();
  }catch(_e){
    // ignore
  }
}

async function handleChallengeReminder(which){
  if(which !== 'best' && which !== 'worst') return;
  if(!state.me){
    toast('Please sign in first, then click the reminder link again.');
    openAuth('signup');
    return;
  }
  try{
    const r = await api('/api/remind', {
      method: 'POST',
      body: JSON.stringify({ challenge: which })
    });
    if(r?.ok){
      toast('Got it — we\'ll email you when challenges go live.');
    }else{
      toast(r?.error || 'Could not save reminder.');
    }
  }catch(e){
    toast('Could not save reminder.');
  }
}

async function maybeDispatchReminderEmails(){
  // Best-effort dispatch. This runs when OFFICIAL_BRACKET_LIVE is true.
  // It is idempotent and safe if called multiple times.
  try{
    const last = Number(localStorage.getItem('bb_reminder_dispatch') || '0');
    const now = Date.now();
    // At most once every 6 hours per browser
    if(now - last < 6*60*60*1000) return;
    localStorage.setItem('bb_reminder_dispatch', String(now));
    await fetch('/api/remind-dispatch', { method: 'POST' });
  }catch(_e){
    // ignore
  }
}

const qs = (s, el=document) => el.querySelector(s);
const qsa = (s, el=document) => Array.from(el.querySelectorAll(s));
const el = (tag, cls) => { const n=document.createElement(tag); if(cls) n.className=cls; return n; };


function loadLeadPrefs(){
  try{
    const raw = localStorage.getItem('bb_lead_prefs');
    if(!raw) return { live:false, upcoming:false, offers:false };
    const obj = JSON.parse(raw);
    return {
      live: !!obj.live,
      upcoming: !!obj.upcoming,
      offers: !!obj.offers
    };
  }catch(_e){
    return { live:false, upcoming:false, offers:false };
  }
}

// Tracks which opt-ins have been successfully saved to the server.
// Used for UI: once an option is saved, that checkbox row disappears on all pages.
function loadLeadSigned(email){
  try{
    const key = 'bb_lead_signed_map';
    const raw = localStorage.getItem(key);
    const map = raw ? JSON.parse(raw) : {};
    const e = String(email||'').trim().toLowerCase();
    if(!e) return { live:false, upcoming:false, offers:false };
    const obj = map[e] || {};
    return { live: !!obj.live, upcoming: !!obj.upcoming, offers: !!obj.offers };
  }catch(_e){
    return { live:false, upcoming:false, offers:false };
  }
}
function saveLeadSigned(p, email){
  try{
    const key = 'bb_lead_signed_map';
    const raw = localStorage.getItem(key);
    const map = raw ? JSON.parse(raw) : {};
    const e = String(email||'').trim().toLowerCase();
    if(!e){
      // fallback: keep legacy behavior if no email is known
      const legacy = {
        live: !!p.live,
        upcoming: !!p.upcoming,
        offers: !!p.offers
      };
      localStorage.setItem('bb_lead_signed', JSON.stringify(legacy));
      return legacy;
    }
    const cur = map[e] || { live:false, upcoming:false, offers:false };
    const next = {
      live: cur.live || !!p.live,
      upcoming: cur.upcoming || !!p.upcoming,
      offers: cur.offers || !!p.offers
    };
    map[e] = next;
    localStorage.setItem(key, JSON.stringify(map));
    return next;
  }catch(_e){
    return { live: !!p.live, upcoming: !!p.upcoming, offers: !!p.offers };
  }
}

function applyLeadSignedVisibility(prefix, emailEl){
  // Intentionally disabled: keep the email signup checkboxes visible on all pages.
  // (Opt-ins still save to D1; unchecking does not unsubscribe.)
  return;
}
function saveLeadPrefs(p){
  try{
    const cur = loadLeadPrefs();
    const next = {
      live: cur.live || !!p.live,
      upcoming: cur.upcoming || !!p.upcoming,
      offers: cur.offers || !!p.offers
    };
    localStorage.setItem('bb_lead_prefs', JSON.stringify(next));
    return next;
  }catch(_e){
    return { live: !!p.live, upcoming: !!p.upcoming, offers: !!p.offers };
  }
}
function isValidEmailBasic(email){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email||'').trim());
}

async function saveLead({ email, source, optin_live, optin_upcoming, optin_offers, msgEl }){
  if(!email){
    if(msgEl) msgEl.textContent = 'Please enter an email.';
    return false;
  }
  try{ localStorage.setItem('bb_lead_email', email); }catch(_e){}
  if(msgEl) msgEl.textContent = 'Saving...';
  try{
    const res = await fetch('/api/lead', {
      method: 'POST',
      headers: { 'content-type':'application/json' },
      body: JSON.stringify({ email, source, optin_live, optin_upcoming, optin_offers })
    });
    const data = await res.json().catch(()=>null);
    if(!res.ok){
      if(msgEl) msgEl.textContent = (data && (data.message || data.error)) || 'Could not save.';
      return false;
    }
    if(msgEl) msgEl.textContent = "You’re in — we’ll email you when challenges go live.";
    return true;
  }catch(_e){
    if(msgEl) msgEl.textContent = 'Could not save. Please try again.';
    return false;
  }
}

function bindLeadForm(prefix, source){
  const emailEl = qs(`#remindEmail${prefix}`);
  const btn = qs(`#remindBtn${prefix}`);
  const msgEl = qs(`#remindMsg${prefix}`);
  const liveEl = qs(`#leadLive${prefix}`);
  const upcomingEl = qs(`#leadUpcoming${prefix}`);
  const offersEl = qs(`#leadOffers${prefix}`);
  if(!emailEl || !btn) return;

  // Restore last email + persistent opt-in choices (opt-ins only ever add; unchecking does not remove).
  try{
    const savedEmail = (localStorage.getItem('bb_lead_email') || '').trim();
    if(savedEmail && !emailEl.value) emailEl.value = savedEmail;
  }catch(_e){}
  const prefs = loadLeadPrefs();
  if(liveEl) liveEl.checked = !!prefs.live;
  if(upcomingEl) upcomingEl.checked = !!prefs.upcoming;
  if(offersEl) offersEl.checked = !!prefs.offers;

  // Hide any options already successfully signed up for on other pages.
  applyLeadSignedVisibility(prefix, emailEl);

  let autosaveTimer = null;
  async function maybeAutoSave(){
    const email = (emailEl.value || '').trim();
    const optin_live = !!liveEl?.checked;
    const optin_upcoming = !!upcomingEl?.checked;
    const optin_offers = !!offersEl?.checked;

    // Persist prefs locally even if we can't save yet (no email entered).
    saveLeadPrefs({ live: optin_live, upcoming: optin_upcoming, offers: optin_offers });

    if(!email || !isValidEmailBasic(email)) return;
    if(!(optin_live || optin_upcoming || optin_offers)) return;

    // Debounce server writes a bit to avoid spamming the API on quick clicks.
    if(autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(async ()=>{
      const ok = await saveLead({ email, source, optin_live, optin_upcoming, optin_offers, msgEl });
      if(ok){
        const nextSigned = saveLeadSigned({ live: optin_live, upcoming: optin_upcoming, offers: optin_offers }, email);
        applyLeadSignedVisibility(prefix, emailEl);
        // Keep the blinking cursor (focus) until all three boxes have been signed.
        try{
          if(!(nextSigned.live && nextSigned.upcoming && nextSigned.offers)){
            emailEl.focus();
          }
        }catch(_e){}
      }
    }, 250);
  }

  function preventUncheck(chk, keyLabel){
    if(!chk) return;
    chk.addEventListener('change', ()=>{
      if(!chk.checked){
        // Do not allow unchecking to remove the user from a list.
        chk.checked = true;
        if(msgEl) msgEl.textContent = 'To stop emails, use the unsubscribe link in an email.';
      }
      maybeAutoSave();
    });
  }
  preventUncheck(liveEl, 'official');
  preventUncheck(upcomingEl, 'upcoming');
  preventUncheck(offersEl, 'offers');

  // Auto-save when email changes (so user doesn't need to click Sign me up).
  emailEl.addEventListener('input', ()=>{ if(msgEl) msgEl.textContent=''; maybeAutoSave(); });
  emailEl.addEventListener('blur', ()=>{ maybeAutoSave(); });

  btn.addEventListener('click', async ()=>{
    const email = (emailEl.value || '').trim();
    const optin_live = !!liveEl?.checked;
    const optin_upcoming = !!upcomingEl?.checked;
    const optin_offers = !!offersEl?.checked;

    // Persist and save (click still works as explicit action).
    saveLeadPrefs({ live: optin_live, upcoming: optin_upcoming, offers: optin_offers });

    const ok = await saveLead({ email, source, optin_live, optin_upcoming, optin_offers, msgEl });
    if(ok){
      const nextSigned = saveLeadSigned({ live: optin_live, upcoming: optin_upcoming, offers: optin_offers }, email);
      applyLeadSignedVisibility(prefix, emailEl);
      // Keep focus (blinking cursor) until all three boxes have been signed.
      try{
        if(!(nextSigned.live && nextSigned.upcoming && nextSigned.offers)){
          emailEl.focus();
        }
      }catch(_e){}
      const prevText = btn.textContent;
      btn.textContent = 'Saved';
      btn.classList.add('saved');
      setTimeout(()=>{ try{ btn.textContent = prevText; btn.classList.remove('saved'); }catch(_e){} }, 1400);
    }
  });

  // If a saved email exists AND at least one box is checked, auto-save once on load.
  setTimeout(()=>{ try{ maybeAutoSave(); }catch(_e){} }, 50);
}


function bindLeadFormsForPage(){
  const path = (location && location.pathname) ? String(location.pathname) : '';
  // Full bracket challenge pages (standalone)
  if(path.endsWith('/best-challenge.html') || path.endsWith('best-challenge.html')){
    bindLeadForm('', 'best_full');
  }else if(path.endsWith('/worst-challenge.html') || path.endsWith('worst-challenge.html')){
    bindLeadForm('', 'worst_full');
  }

  // Home embedded views (Second Chance + Upcoming Events)
  bindLeadForm('Best2', 'best_second');
  bindLeadForm('Worst2', 'worst_second');
  bindLeadForm('Upcoming', 'upcoming');
}
async function toast(msg){
  const t = qs('#toast');
  if(!t){ alert(msg); return; }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(()=>t.classList.remove('show'), 2600);
}

function confirmModal(message, okText='OK', cancelText='Cancel'){
  return new Promise((resolve)=>{
    // Build lightweight modal (so we can control button labels; Safari's window.confirm can't).
    const overlay = el('div','bb-confirm-overlay');
    const box = el('div','bb-confirm-box');

    const msg = el('div','bb-confirm-message');
    msg.textContent = message;

    const btnRow = el('div','bb-confirm-actions');

    // Primary (OK) first, then secondary (Cancel)
    const ok = el('button','bb-confirm-btn ok');
    ok.type = 'button';
    ok.textContent = okText;

    const cancel = el('button','bb-confirm-btn cancel');
    cancel.type = 'button';
    cancel.textContent = cancelText;

    btnRow.append(ok, cancel);
    box.append(msg, btnRow);
    overlay.append(box);
    document.body.append(overlay);

    const cleanup = () => overlay.remove();
    cancel.addEventListener('click', ()=>{ cleanup(); resolve(false); });
    ok.addEventListener('click', ()=>{ cleanup(); resolve(true); });
    overlay.addEventListener('click', (e)=>{
      if(e.target === overlay){ cleanup(); resolve(false); }
    });
  });
}

async function api(path, opts={}){
  const res = await fetch(path, {
    headers: { "content-type":"application/json", ...(opts.headers||{}) },
    credentials: "include",
    ...opts
  });
  const txt = await res.text();
  let data = null;
  try{ data = JSON.parse(txt); }catch{ data = { ok:false, error: txt }; }
  if(!res.ok){
    const err = new Error(data?.error || 'Request failed');
    err.data = data;
    err.status = res.status;
    throw err;
  }
  return data;
}

// Convenience wrappers used throughout the app.
// Defined here so Safari/strict mode never throws "Can't find variable".
async function apiGet(path){
  return api(path, { method: 'GET' });
}
async function apiPost(path, body){
  return api(path, { method: 'POST', body: JSON.stringify(body ?? {}) });
}

async function maybeAskSubmitFeatured(bracketId){
  try{
    if(!state || !state.me) return;
    if(!bracketId) return;

    const msg = "Do you want to Submit Your Bracket for a Chance to be on our Featured Brackets Page and/or Appear on our TikTok?";
    const yes = await confirmModal(msg, 'Yes', 'No');
    if(!yes) return;

    // Create a pending feature request for admin review.
    // Safe: API de-dupes if already submitted.
    try{
      await apiPost('/api/feature', { bracket_id: bracketId, caption: '' });
    }catch(e){
      // Do not block redirect on email/API issues
      console.warn('feature submit failed', e);
    }
  }catch(_){}
}

async function apiPut(path, body){
  return api(path, { method: 'PUT', body: JSON.stringify(body ?? {}) });
}
async function apiDelete(path, body){
  return api(path, { method: 'DELETE', body: body === undefined ? undefined : JSON.stringify(body) });
}


// -------------------- Challenge helpers (global-safe) --------------------
// Some Safari/strict-mode builds can scope function declarations unexpectedly.
// These helpers are attached to window so view-switching never crashes.

function renderChallengeCallout() {
  // Home page must be bracket-only. This callout is intentionally disabled.
  return;
}

// If renderChallenges already exists elsewhere, we will still attach it to window below.
// If not, define a safe no-op so navigation never breaks.
if (typeof renderChallenges !== 'function') {
  async function renderChallenges() { /* no-op fallback */ }
}
function setGroupNotice(challenge, text, kind){
  const isBest = challenge==='best';
  const n = qs(isBest ? '#bestGroupNotice' : '#worstGroupNotice');
  if(!n) return;
  if(!text){
    n.style.display = 'none';
    n.textContent = '';
    n.classList.remove('pending','full');
    return;
  }
  n.textContent = text;
  n.classList.remove('pending','full');
  if(kind) n.classList.add(kind);
  n.style.display = '';
}

let PUBLIC_CONFIG = null;
let LOCK_AT_MS = null;
function bracketsLockedNow(){
  if(!PUBLIC_CONFIG || !PUBLIC_CONFIG.lock_enabled) return false;
  if(!LOCK_AT_MS) return false;
  return Date.now() >= LOCK_AT_MS;
}
async function loadPublicConfig(){
  if(PUBLIC_CONFIG) return PUBLIC_CONFIG;
  try{
    PUBLIC_CONFIG = await api('/api/public', {method:'GET'});
    if(PUBLIC_CONFIG && PUBLIC_CONFIG.lock_enabled && PUBLIC_CONFIG.lock_at_iso){
      const ms = Date.parse(PUBLIC_CONFIG.lock_at_iso);
      if(!Number.isNaN(ms)) LOCK_AT_MS = ms;
    }
    OFFICIAL_BRACKET_LIVE = !!(PUBLIC_CONFIG && PUBLIC_CONFIG.official_bracket_live);
  }catch(e){
    PUBLIC_CONFIG = {ok:false, affiliate_join_url:"", group_upgrade_checkout_url_base:""};
  }
  return PUBLIC_CONFIG;
}

function shouldShowAffiliate(groupId){
  const key = `aff_shown:${groupId}`;
  return !localStorage.getItem(key);
}
function markAffiliateShown(groupId){
  const key = `aff_shown:${groupId}`;
  try{ localStorage.setItem(key, '1'); }catch(e){}
}

async function showAffiliateModalAfterJoin(group){
  const cfg = await loadPublicConfig();
  const url = (cfg && cfg.affiliate_join_url) ? String(cfg.affiliate_join_url) : "";
  if(!url) return;
  if(!group || !group.id) return;
  if(!shouldShowAffiliate(group.id)) return;

  // Build simple modal
  const overlay = document.createElement('div');
  overlay.className = 'modalOverlay';
  overlay.innerHTML = `
    <div class="modalCard">
      <div class="modalTitle">You joined “${escapeHtml(group.name||'Group')}” 🎉</div>
      <div class="modalBody">
        <div class="smallMuted">Optional:</div>
        <div class="modalText">If you&apos;re planning to put a little action on the games (off-site), you can use our partner link. No betting happens on Bracketology Builder.</div>
        <a class="btnPrimary fullWidth" target="_blank" rel="noopener" href="${escapeAttr(url)}">Open partner link</a>
        <div class="tinyMuted">21+ where legal. Terms apply. If you or someone you know has a gambling problem, call 1-800-GAMBLER.</div>
        <button class="btnGhost fullWidth" id="affContinueBtn">Continue</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#affContinueBtn')?.addEventListener('click', ()=>{
    markAffiliateShown(group.id);
    overlay.remove();
  });
  overlay.addEventListener('click', (e)=>{ if(e.target===overlay){ markAffiliateShown(group.id); overlay.remove(); }});
}

function escapeHtml(s){
  return String(s||"").replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c]));
}
function escapeAttr(s){ return escapeHtml(s).replace(/"/g,"&quot;"); }


function isMobile(){ return window.matchMedia('(max-width: 900px)').matches; }

// ===== Phase 3 (mobile): Final Four completion cue (informational only) =====
const __phase3 = { hasInteracted: false, hasSaved: false };

function phase3UpdateVisibility(){
  const el = document.getElementById('phase3Cue');
  if(!el) return;
  const show = isMobile();
  el.style.display = show ? 'block' : 'none';
  el.setAttribute('aria-hidden', show ? 'false' : 'true');
}

function phase3MarkInteracted(){
  if(__phase3.hasInteracted) return;
  __phase3.hasInteracted = true;
  phase3UpdateVisibility();
}


// ===== Phase 4: Submit for Featured (post-save, logged-in only) =====
const __phase4 = { submittedByBracket: {} };

async function phase4RefreshStatus(bracketId){
  if(!bracketId || !state.me) return null;
  if(__phase4.submittedByBracket[bracketId] !== undefined) return __phase4.submittedByBracket[bracketId];
  try{
    const res = await api('/api/feature-status?bracket_id=' + encodeURIComponent(bracketId), { method:'GET' });
    __phase4.submittedByBracket[bracketId] = !!(res && res.submitted);
    return __phase4.submittedByBracket[bracketId];
  }catch(e){
    return null;
  }
}

async function phase4UpdateFeatureCTA(){
  const row = qs('#featureAfterSaveRow');
  const btn = qs('#submitFeaturedAfterSaveBtn');
  const msg = qs('#featureAfterSaveMsg');
  if(!row || !btn) return;

  // Show ONLY when logged in AND viewing a saved bracket (has bracketId).
  const bracketId = state.bracketId;
  const shouldConsider = !!(state.me && bracketId);

  if(!shouldConsider){
    row.style.display = 'none';
    if(msg) msg.textContent = '';
    return;
  }

  // Check if already submitted
  const already = await phase4RefreshStatus(bracketId);
  if(already){
    row.style.display = 'none';
    if(msg) msg.textContent = '';
    return;
  }

  // Only visible after a save (i.e., bracketId exists). This is true for saved brackets.
  row.style.display = 'flex';
  if(msg) msg.textContent = '';

  if(!btn.__wired){
    btn.__wired = true;
    btn.addEventListener('click', async ()=>{
      try{
        btn.disabled = true;
        await api('/api/feature', { method:'POST', body: JSON.stringify({ bracket_id: state.bracketId, caption: '' })});
        __phase4.submittedByBracket[state.bracketId] = true;
        row.style.display = 'none';
        toast('Submitted! If approved, your bracket may appear on the site or TikTok.');
      }catch(e){
        toast('Could not submit. Please try again.');
      }finally{
        btn.disabled = false;
      }
    });
  }
}

function phase3MarkSaved(){
  if(__phase3.hasSaved) return;
  __phase3.hasSaved = true;
  phase3UpdateVisibility();
}
function nowStamp(){
  const d = new Date(GENERATED_AT_VALUE || Date.now());
  return d.toLocaleString();
}

// -------------------- State --------------------
const STORAGE_KEY = 'bb_v30_picks_local';
const STORAGE_META = 'bb_v30_meta';
const state = {
  // set from URL param second=1

  bracket_type: null,

  me: null,
  bracketId: null,      // D1 bracket id if saved
  bracketTitle: '',
  picks: {},
  undoStack: [],
  autosaveTimer: null,
  lastSavedHash: '',
  promptedForAuth: false,
  resultsMap: {},       // gameId -> winner team
  resultsMeta: { actualFinalTotal: null },
  view: 'build',
  shareContext: { challenge: null, stage: null },
  readOnly: false,
  sharedOwnerId: null,
  ui: {
    // Preserve mobile scroll positions across re-renders (prevents jitter).
    regionScrollLeft: {},
  },
};

// -------------------- Key Scheme --------------------
// Region keys are the data constants names.
const REGIONS = [
  { key:'REGION_SOUTH',  name:'South',  teams:REGION_SOUTH },
  { key:'REGION_WEST',   name:'West',   teams:REGION_WEST },
  { key:'REGION_EAST',   name:'East',   teams:REGION_EAST },
  { key:'REGION_MIDWEST',name:'Midwest',teams:REGION_MIDWEST },
];


// Determine which two region KEYS are on the LEFT and RIGHT halves of the desktop bracket,
// based on the current DOM layout (.deskCol.left / .deskCol.right).
// Returns { leftKeys: ['REGION_SOUTH','REGION_WEST'], rightKeys: [...] }.
// Falls back to standard NCAA pairing if DOM is unavailable.
function getRegionKeyHalvesFromDom(){
  try{
    const left = [];
    const right = [];
    REGIONS.forEach(r=>{
      const mount = document.querySelector(`#region-${r.name}`);
      if(!mount) return;
      const colRight = mount.closest && mount.closest('.deskCol.right');
      const rect = mount.getBoundingClientRect();
      const entry = { key: r.key, top: rect.top };
      (colRight ? right : left).push(entry);
    });

    if(left.length===2 && right.length===2){
      // sort by vertical position (top first = upper region)
      left.sort((a,b)=>a.top-b.top);
      right.sort((a,b)=>a.top-b.top);
      return {
        leftKeys: [left[0].key, left[1].key],   // upper left, lower left
        rightKeys:[right[0].key,right[1].key]  // upper right, lower right
      };
    }
  }catch(_e){}

  return { 
    leftKeys: ['REGION_SOUTH','REGION_WEST'], 
    rightKeys:['REGION_EAST','REGION_MIDWEST'] 
  };
}


function wKey(regionKey, roundIdx, gameIdx){ return `${regionKey}__R${roundIdx}__G${gameIdx}__winner`; }

// -------------------- Bracket Logic --------------------
const PAIRINGS = [[1,16],[8,9],[5,12],[4,13],[6,11],[3,14],[7,10],[2,15]];
const SEEDS = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16];

function listToSeedArray(seedList){
  const map = new Map();
  (seedList||[]).forEach(([seed, name])=> map.set(seed, name));

  // Home-page-only seed tweak: show Miami (OH) instead of UCLA on the projection/home bracket.
  // IMPORTANT: Only applies when the user is on the home page AND not viewing an existing saved bracket.
  try{
    const path = (window.location && window.location.pathname) ? window.location.pathname : '';
    const isHome = (path === '/' || path === '' || path.endsWith('/index.html'));
    const sp = new URLSearchParams(window.location.search || '');
    const hasBracketId = !!(sp.get('bracketId') || sp.get('id'));
    if(isHome && !hasBracketId){
      // Replace the seed name without mutating the source data constants.
      for(const [seed, name] of map.entries()){
        if(name === 'UCLA'){
          map.set(seed, 'Miami (OH)');
        }
      }
    }
  }catch(_e){}

  return SEEDS.map(s => map.get(s) ? ({ seed:s, name: map.get(s) }) : null);
}

function teamEq(a,b){ return !!a && !!b && a.seed===b.seed && a.name===b.name; }
function teamInPair(team, pair){ return !!team && !!pair && (teamEq(team, pair[0]) || teamEq(team, pair[1])); }

function buildRoundTeams(regionKey, baseTeams, picks, roundIdx){
  // Returns array of pairs for the given round within a region.
  // roundIdx: 0 R64 (8 games) -> 1 R32 (4) -> 2 S16 (2) -> 3 E8 (1)
  if(roundIdx === 0){
    // baseTeams is a 16-length seed array: index seed-1.
    return PAIRINGS.map(([a,b]) => [ baseTeams[a-1], baseTeams[b-1] ]);
  }
  const prev = buildRoundTeams(regionKey, baseTeams, picks, roundIdx-1);
  const winners = prev.map((pair, gIdx) => picks[wKey(regionKey, roundIdx-1, gIdx)] || null);
  const out = [];
  for(let i=0;i<winners.length;i+=2){
    out.push([winners[i]||null, winners[i+1]||null]);
  }
  return out;
}

// Sweet 16 mode (Second Chance):
// - Home page: always show Sweet 16 bracket when enabled.
// - Bracket pages: ONLY show Sweet 16 for second_chance brackets.
//   Official + Bracketology brackets must remain full even when Sweet 16 is enabled.
function sweet16ModeEnabled(){
  if(!(PUBLIC_CONFIG && PUBLIC_CONFIG.sweet16_set)) return false;

  const path = (window.location && window.location.pathname) ? window.location.pathname : '';
  const isHome = (path === '/' || path === '' || path.endsWith('/index.html'));
  if(isHome) return true;

  // Bracket page: gate on bracket type (or URL hints for new second-chance brackets).
  try{
    if(document.body && document.body.classList.contains('page-bracket')){
      const u = new URL(window.location.href);
      const urlSecond = (u.searchParams.get('second') === '1');
      const urlKind = (u.searchParams.get('kind') || u.searchParams.get('type') || '').toLowerCase();
      const bt = String(state.bracket_type || state.bracketType || '').toLowerCase();
      return urlSecond || urlKind === 'second_chance' || bt === 'second_chance';
    }
  }catch(e){}
  return false;
}

function getTeamBySeed(regionKey, seed){
  const r = REGIONS.find(x=>x.key===regionKey);
  if(!r) return null;
  const base = listToSeedArray(r.teams);
  return base[seed-1] || null;
}

function ensurePlaceholderToSweet16(picks){
  // When Sweet 16 is enabled but early-round results aren't entered yet,
  // force rounds 0-1 picks to advance the top 4 seeds (1,2,3,4) in each region.
  // This makes the bracket effectively start at Sweet 16 without breaking existing key scheme.
  const np = { ...(picks||{}) };
  for(const r of REGIONS){
    const base = listToSeedArray(r.teams);
    const t1 = base[0], t2 = base[1], t3 = base[2], t4 = base[3];
    const t5 = base[4], t6 = base[5], t7 = base[6], t8 = base[7];
    const t16 = base[15], t15 = base[14], t14 = base[13], t13 = base[12], t12 = base[11], t11 = base[10], t10 = base[9], t9 = base[8];
    // Round of 64 (R0) winners to set up Round of 32 matchups that lead to top 4 seeds.
    // Pairings: (1/16),(8/9),(5/12),(4/13),(6/11),(3/14),(7/10),(2/15)
    if(t1 && t16) np[wKey(r.key,0,0)] = t1;
    if(t8 && t9)  np[wKey(r.key,0,1)] = t8;
    if(t5 && t12) np[wKey(r.key,0,2)] = t5;
    if(t4 && t13) np[wKey(r.key,0,3)] = t4;
    if(t6 && t11) np[wKey(r.key,0,4)] = t6;
    if(t3 && t14) np[wKey(r.key,0,5)] = t3;
    if(t7 && t10) np[wKey(r.key,0,6)] = t7;
    if(t2 && t15) np[wKey(r.key,0,7)] = t2;
    // Round of 32 (R1) winners: 1 over 8, 4 over 5, 3 over 6, 2 over 7
    if(t1 && t8) np[wKey(r.key,1,0)] = t1;
    if(t5 && t4) np[wKey(r.key,1,1)] = t4;
    if(t6 && t3) np[wKey(r.key,1,2)] = t3;
    if(t7 && t2) np[wKey(r.key,1,3)] = t2;
  }
  return np;
}

function getPlaceholderSweet16Field(regionKey){
  // Returns 4 teams in bracket order: (t0 vs t1), (t2 vs t3).
  // Use 1 vs 4 and 3 vs 2 as a simple placeholder field.
  const t1 = getTeamBySeed(regionKey, 1);
  const t2 = getTeamBySeed(regionKey, 2);
  const t3 = getTeamBySeed(regionKey, 3);
  const t4 = getTeamBySeed(regionKey, 4);
  return [t1, t4, t3, t2];
}


// Fill the bracket with random picks.

function updateUndoUI(){
  const has = state.undoStack && state.undoStack.length>0;
  // Support multiple Undo buttons (e.g., bracket header + mobile topbar)
  const btns = [qs('#undoBtnTop'), qs('#undoBtnHeader')].filter(Boolean);
  if(!btns.length) return;
  for(const btn of btns){
    btn.disabled = !has;
    btn.classList.toggle('disabled', !has);
  }
}

function pushUndoSnapshot(){
  try{
    const snap = JSON.stringify(state.picks || {});
    const st = state.undoStack || (state.undoStack = []);
    if(st.length && st[st.length-1] === snap) return;
    st.push(snap);
    if(st.length > 50) st.shift();
    updateUndoUI();
  }catch(e){
    console.warn('pushUndoSnapshot failed', e);
  }
}

function commitPicks(np, reason){
  // READONLY_GUARD: prevent any local edits when viewing read-only (e.g., Featured Brackets)
  if(state && state.readOnly && (reason === 'pick' || reason === 'random')){
    return;
  }
  // reason: 'pick' | 'random' | 'load'
  if(reason === 'pick' || reason === 'random'){
    // Phase 3 cue: show after first interaction (mobile only)
    phase3MarkInteracted();
    pushUndoSnapshot();
  }
  state.picks = normalize(np || {});
  saveLocal(state.picks);

  renderAll();

  /* === AUTO_RANDOM_NEW_BRACKET ===
     If user clicked "Create new bracket with random picks" from My Brackets,
     auto-fill random picks when loading bracket.html?new=1&random=1.
     Never runs when editing an existing saved bracket (opened via bracketId).
  */
  try{
    const spAuto = new URLSearchParams(location.search);
    const isBracketPage = location.pathname.endsWith('bracket.html');
    const wantsRandom = (spAuto.get('random') === '1');
    const isNew = (spAuto.get('new') === '1');
    const meta = getBracketMetaFromUrl();
    const hasExisting = !!(meta && meta.bracketId);
    const key = 'bb_autofill_random_done:' + location.search;

    if(isBracketPage && wantsRandom && isNew && !hasExisting && !sessionStorage.getItem(key)){
      // Force fresh state for this new bracket, then fill random picks.
      state.picks = {};
      saveLocal(state.picks);
      fillRandomPicks(); // commits + re-renders
      saveLocal(state.picks);
      sessionStorage.setItem(key, '1');
    }
  }catch(_e){} 

scheduleAutosave();
  if(reason === 'pick') maybeAutoShiftMobile();
}

function undoLastAction(){
  try{
    const st = state.undoStack || [];
    if(!st.length){
      toast('Nothing to undo.');
      return;
    }
    const snap = st.pop();
    const prev = JSON.parse(snap || '{}');
    state.picks = normalize(prev);
    saveLocal(state.picks);
    renderAll();
    scheduleAutosave();
    updateUndoUI();
    toast('Undone.');
  }catch(e){
    console.warn('undo failed', e);
    toast('Could not undo.');
  }
}

function fillRandomPicks(){
  const picks = {};

  // Region rounds
  for(const r of REGIONS){
    const base = listToSeedArray(r.teams);
    for(let round=0; round<=3; round++){
      const games = buildRoundTeams(r.key, base, picks, round);
      for(let g=0; g<games.length; g++){
        const [a,b] = games[g];
        if(!a || !b) continue;
        const winner = (Math.random() < 0.5) ? a : b;
        picks[wKey(r.key, round, g)] = winner;
      }
    }
  }

  // Final Four + Final + Champion
  // IMPORTANT: Final Four pairing must match pruneInvalidPicks() / UI pairing.
  // Pairing is based on LEFT vs RIGHT halves of the bracket (not region names).
  const halves = getRegionKeyHalvesFromDom();
  const ffPairs = [
    [picks[wKey(halves.leftKeys[0],3,0)]  || null, picks[wKey(halves.leftKeys[1],3,0)]  || null],  // LEFT half
    [picks[wKey(halves.rightKeys[0],3,0)] || null, picks[wKey(halves.rightKeys[1],3,0)] || null], // RIGHT half
  ];
  for(let i=0;i<2;i++){
    const a = ffPairs[i][0];
    const b = ffPairs[i][1];
    if(a && b){
      picks[`FF__G${i}__winner`] = (Math.random() < 0.5) ? a : b;
    }
  }

  const f0 = picks['FF__G0__winner']||null;
  const f1 = picks['FF__G1__winner']||null;
  if(f0 && f1){
    picks['FINAL__winner'] = (Math.random() < 0.5) ? f0 : f1;
    // Champion mirrors FINAL winner in this UI
    picks['CHAMPION'] = picks['FINAL__winner'];
  }
  commitPicks(picks, 'random');
}

function pruneInvalidPicks(picks){
  // Remove any later-round winners that are no longer possible.
  // Region rounds
  for(const r of REGIONS){
    const base = listToSeedArray(r.teams);
    for(let round=0; round<=3; round++){
      const games = buildRoundTeams(r.key, base, picks, round);
      for(let g=0; g<games.length; g++){
        const k = wKey(r.key, round, g);
        const w = picks[k];
        if(w && !teamInPair(w, games[g])) delete picks[k];
      }
    }
  }

  // Final Four
  // Pairing is based on LEFT vs RIGHT halves of the bracket (not region names).
  const halves = getRegionKeyHalvesFromDom();
  const ffPairs = [
    [picks[wKey(halves.leftKeys[0],3,0)]  || null, picks[wKey(halves.leftKeys[1],3,0)]  || null],  // LEFT half
    [picks[wKey(halves.rightKeys[0],3,0)] || null, picks[wKey(halves.rightKeys[1],3,0)] || null], // RIGHT half
  ];
  for(let i=0;i<2;i++){
    const k = `FF__G${i}__winner`;
    const w = picks[k];
    if(w && (!ffPairs[i][0] || !ffPairs[i][1] || !teamInPair(w, ffPairs[i]))) delete picks[k];
  }

  const finalPair = [picks['FF__G0__winner']||null, picks['FF__G1__winner']||null];
  if(picks['FINAL__winner'] && (!finalPair[0] || !finalPair[1] || !teamInPair(picks['FINAL__winner'], finalPair))) delete picks['FINAL__winner'];
  if(picks['CHAMPION'] && !teamEq(picks['CHAMPION'], picks['FINAL__winner'])) delete picks['CHAMPION'];

  // If a Final winner exists, treat it as the Champion (we don't render a separate Champion box).
  if(picks['FINAL__winner']) picks['CHAMPION'] = picks['FINAL__winner'];

  return picks;
}

function normalize(picks){
  const out = {...(picks||{})};
  for(const [k,v] of Object.entries(out)){
    if(!(k.endsWith('__winner') || k==='FINAL__winner' || k==='CHAMPION')) continue;
    if(!v || typeof v !== 'object') { delete out[k]; continue; }
    if(typeof v.name !== 'string' || v.name.trim()==='') { delete out[k]; continue; }
    if(typeof v.seed !== 'number' || !SEEDS.includes(v.seed)) { delete out[k]; continue; }
  }
  pruneInvalidPicks(out);
  return out;
}

// -------------------- Local storage --------------------
function loadLocal(){
  try{ return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')); }catch{ return {}; }
}
function saveLocal(picks){
  const norm = normalize(picks);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(norm));
  state.picks = norm;
}

function loadMeta(){
  try{ return JSON.parse(localStorage.getItem(STORAGE_META)||'{}'); }catch{ return {}; }
}
function saveMeta(meta){
  localStorage.setItem(STORAGE_META, JSON.stringify(meta||{}));
}

// -------------------- Account --------------------
async function refreshMe(){
  try{
    const d = await api('/api/me', { method:'GET' });
    state.me = d.user || null;
  }catch{ state.me = null; }
  renderAccountState();
}

async function loadResults(){
  try{
    const d = await api('/api/results', { method:'GET' });
    const map = {};
    let finalTotal = null;
    (d.games||[]).forEach(g=>{
      if(g && g.id && g.winner) map[g.id] = g.winner;
      if(g && g.id === 'FINAL' && (g.score_total!==null && g.score_total!==undefined)) finalTotal = Number(g.score_total);
    });
    state.resultsMap = map;
    state.resultsMeta.actualFinalTotal = Number.isFinite(finalTotal) ? finalTotal : null;
  }catch(e){
    // keep prior
  }
}



// ---------- Admin Broadcast (Email Alerts) ----------
async function sendAdminBroadcast(panel){
  const seg = (panel && panel.dataset && panel.dataset.segment) ? panel.dataset.segment : 'live';
  const subjEl = panel.querySelector('.adminSubj');
  const msgEl  = panel.querySelector('.adminMsg');
  const linkEl = panel.querySelector('.adminLink');
  const status = panel.querySelector('.adminStatus');
  const btn    = panel.querySelector('.adminSend');

  const subject = (subjEl && subjEl.value || '').trim();
  const message = (msgEl && msgEl.value || '').trim();
  let link = (linkEl && linkEl.value || '').trim();

  if(!subject || !message){
    if(status) status.textContent = 'Subject + message required.';
    return;
  }

  // Default link to current tab/hash if none provided
  if(!link){
    try{
      link = (location.pathname || '/index.html') + (location.hash || '');
    }catch(_){}
  }

  if(status) status.textContent = 'Sending...';
  if(btn) btn.disabled = true;

  try{
    const d = await api('/api/admin/challenge-alert', {
      method:'POST',
      body: JSON.stringify({ subject, message, link, segment: seg })
    });
    if(status) status.textContent = (d && d.ok) ? `Sent: ${d.sent||0}` : 'Send failed.';
  }catch(e){
    if(status) status.textContent = 'Send failed.';
  }finally{
    if(btn) btn.disabled = false;
  }
}

function wireAdminBroadcastPanels(){
  const isAdm = !!(state && state.me && state.me.isAdmin);
  document.querySelectorAll('.adminBroadcast').forEach(panel=>{
    panel.style.display = isAdm ? '' : 'none';
    if(!isAdm) return;
    if(panel._wired) return;
    panel._wired = true;
    const btn = panel.querySelector('.adminSend');
    if(btn){
      btn.addEventListener('click', ()=>sendAdminBroadcast(panel));
    }
  });
}

function wireAdminNavLinks(){
  const isAdm = !!(state && state.me && state.me.isAdmin);
  qsa('.adminOnly').forEach(a=>{
    a.style.display = isAdm ? '' : 'none';
  });
}

function applyReadOnlyUI(){
  const ro = !!(state && state.readOnly);
  document.body.classList.toggle('readOnly', ro);

  const disable = (sel)=>{
    const b = qs(sel);
    if(!b) return;
    b.disabled = ro ? true : b.disabled;
    if(ro) b.classList.add('disabled');
  };

  // Prevent local edits in a read-only view.
  disable('#saveBtnHeader');
  disable('#saveBtn');
  disable('#saveEnterBtnTop');
  disable('#undoBtnTop');
  disable('#undoBtnHeader');
  disable('#randomPicksBtnTop');
  disable('#randomPicksBtnHeader');

  const title = qs('#bracketPageTitle');
  if(title){
    if(ro){
      title.setAttribute('readonly','readonly');
      title.classList.add('readonly');
    }else{
      title.removeAttribute('readonly');
      title.classList.remove('readonly');
    }
  }

  const hint = qs('#signinHint');
  if(hint && ro) hint.textContent = 'Read-only view.';
}
function renderAccountState(){
  const accountBtn = qs('#accountBtn');
  const bracketsBtn = qs('#bracketsBtn');
  const hint = qs('#signinHint');

  // Some tabs/pages don't include these elements—avoid crashes.
  if(!accountBtn && !bracketsBtn && !hint) return;

  if(state.me){
    if(accountBtn) accountBtn.textContent = 'Log out';
    if(bracketsBtn){
      bracketsBtn.disabled = false;
      bracketsBtn.classList.remove('disabled');
    }
    if(hint) hint.textContent = 'Signed in — picks auto-save.';
  }else{
    if(accountBtn) accountBtn.textContent = 'Sign in';
    if(bracketsBtn){
      bracketsBtn.disabled = false; // allow opening overlay which prompts sign-in for list
      bracketsBtn.classList.remove('disabled');
    }
    if(hint) hint.textContent = 'Sign in to save your picks.';
  }

  wireAdminBroadcastPanels();
  wireAdminNavLinks();
  // If a shared bracket flips into read-only after auth resolves, reflect it.
  applyReadOnlyUI();
}

function openAuth(mode='signin', titleText=null) {
  // Default to sign-in when opening the auth modal
  setAuthMode(mode || 'signin');
  const ov = qs('#authOverlay');
  ov.classList.remove('hidden');
  if(titleText && qs('#authTitle')) qs('#authTitle').textContent = titleText;
  qs('#authEmail').focus();
}

function closeAuth(){ qs('#authOverlay').classList.add('hidden'); }

function setAuthMode(mode){
  // mode: 'signin' | 'signup'
  qs('#authMode').value = mode;
  const inBtn = qs('#signInBtn');
  const upBtn = qs('#signUpBtn');
  if(inBtn && upBtn){
    inBtn.classList.toggle('active', mode==='signin');
    upBtn.classList.toggle('active', mode==='signup');
  }
  // Username removed: email-only auth
  qs('#authPassword').setAttribute('autocomplete', mode==='signin' ? 'current-password' : 'new-password');
  const extras = qs('#signupExtras');
  if(extras) extras.style.display = (mode==='signup') ? 'block' : 'none';
}

async function doSignup(email, password){
  // Phase 2: keep signup lightweight (email + password only)
  return api('/api/register', { method:'POST', body: JSON.stringify({ email, password })})
    .then(()=> doSignin(email, password));
}


async function doSignin(email, password){
  await api('/api/login', { method:'POST', body: JSON.stringify({ email, password })});
  await refreshMe();
}

async function requestPasswordReset(email){
  const e = String(email||'').trim().toLowerCase();
  if(!e || !e.includes('@')){ toast('Enter a valid email.'); return; }
  try{
    await api('/api/forgot-password', { method:'POST', body: JSON.stringify({ email: e })});
  }catch(_){
    // Intentionally ignore errors to avoid leaking account state.
  }
  toast("If an account exists for that email, we'll send a reset link.");
}

async function signOut(){
  await api('/api/logout', { method:'POST' });
  state.me = null;
  state.bracketId = null;
  saveMeta({ bracketId:null, bracketTitle: state.bracketTitle });
  renderAccountState();
}

// -------------------- Brackets CRUD --------------------
async function promptForBracketName(defaultName){
  // Returns a trimmed name string, or null if the user cancels.
  let name = (defaultName && String(defaultName).trim()) ? String(defaultName).trim() : '';
  while(true){
    const input = window.prompt('Name your bracket', name);
    if(input === null) return null;
    const trimmed = String(input).trim();
    if(trimmed){
      return trimmed;
    }
    alert('Please enter a bracket name.');
  }
}

// --- URL / bracket meta helpers (used by Save/Enter and My Brackets flows) ---
// These must be available at top-level because multiple handlers call them.
function getBracketMetaFromUrl() {
  const u = new URL(window.location.href);
  const p = u.searchParams;

  // Support a few param names (some older builds used id/title).
  const bracketId = p.get('bracketId') || p.get('id') || '';
  const bracketTitle = p.get('bracketTitle') || p.get('title') || '';
  const kind = p.get('kind') || p.get('type') || '';
  const challengeId = p.get('challengeId') || '';

  return { bracketId, bracketTitle, kind, challengeId };
}

function setUrlBracketId(bracketId, bracketTitle) {
  const u = new URL(window.location.href);
  // Keep both param names for backward compatibility (some pages read id, others read bracketId)
  if (bracketId) {
    u.searchParams.set('bracketId', bracketId);
    u.searchParams.set('id', bracketId);
  }
  if (bracketTitle) u.searchParams.set('bracketTitle', bracketTitle);
  // Clean up legacy params if present.
  window.history.replaceState({}, '', u.toString());
}

function setBracketTitleDisplay(title) {
  // Keep this resilient: different pages/versions used different ids.
  const el =
    qs('#bracketPageTitle') ||
    qs('#bracketTitle') ||
    document.querySelector('.bracketTitle') ||
    document.querySelector('.bracket-title') ||
    document.querySelector('[data-bracket-title]');
  if (!el) return;
  const t = String(title || '').trim();
  // Never show legacy/default titles in the editable field; use placeholder instead.
  const isDefault =
    !t ||
    /^my bracket$/i.test(t) ||
    /^untitled bracket$/i.test(t) ||
    /^name your bracket here$/i.test(t) ||
    /^enter bracket name here$/i.test(t);
  const val = isDefault ? '' : t;
  // Support either a DIV (contentEditable) or an INPUT.
  if ('value' in el) {
    el.placeholder = 'Enter Bracket Name Here';
    el.value = val;
  } else {
    el.textContent = val || 'Enter Bracket Name Here';
  }
}

// If a guest triggers Save / Save & Enter, we queue the action and resume it after auth.
let __pendingPostAuth = null; // { action: 'save' | 'saveEnter' }

function initBracketTitleInlineRename(){
  const el =
    qs('#bracketPageTitle') ||
    qs('#bracketTitle') ||
    document.querySelector('.bracketTitle') ||
    document.querySelector('.bracket-title') ||
    document.querySelector('[data-bracket-title]');
  if(!el) return;
  if(el.dataset && el.dataset.renameBound) return;
  if(el.dataset) el.dataset.renameBound = '1';

  // If it's an input, it already supports editing; if it's a div, enable contentEditable.
  if (!('value' in el)) {
    el.contentEditable = 'true';
    el.spellcheck = false;
  }
  el.title = 'Click to edit bracket name';

  const normalize = (s)=>String(s||'').replace(/\s+/g,' ').trim().slice(0,80);

  const commit = async ()=>{
    const raw = ('value' in el) ? el.value : el.textContent;
    const desired = normalize(raw);
    if(!desired){
      setBracketTitleDisplay(state.bracketTitle);
      return;
    }
    if(desired === (state.bracketTitle||'')) return;

    // If bracket not created yet, just keep locally; Save/Enter will create using this name.
    if(!state.bracketId){
      state.bracketTitle = desired;
      saveMeta({ bracketId: null, bracketTitle: desired });
      setBracketTitleDisplay(desired);
      return;
    }

    const res = await apiPut(`/api/bracket?id=${encodeURIComponent(state.bracketId)}`,
      { id: state.bracketId, title: desired }
    );
    if(res && res.ok){
      state.bracketTitle = desired;
      saveMeta({ bracketId: state.bracketId, bracketTitle: desired });
      setUrlBracketId(state.bracketId, desired);
      setBracketTitleDisplay(desired);
    }else{
      // Revert UI back to last known good title
      setBracketTitleDisplay(state.bracketTitle);
      if(res && (res.status===409 || res.error==='NAME_TAKEN')) toast('You already have a bracket with that name.');
      else toast('Could not rename bracket.');
    }
  };

  el.addEventListener('keydown', (e)=>{
    if(e.key==='Enter'){
      e.preventDefault();
      // On inputs, blur commits; on divs, same.
      el.blur();
    }
  });
  el.addEventListener('blur', ()=>{ commit().catch(()=>{}); });
}

// Read the currently visible bracket title from the DOM (contentEditable header)
// so Save/Enter can persist renames even if the user didn't blur the field.
function getBracketTitleFromDom() {
  const el =
    qs('#bracketPageTitle') ||
    document.querySelector('#bracketTitle') ||
    document.querySelector('.bracketTitle') ||
    document.querySelector('.bracket-title') ||
    document.querySelector('[data-bracket-title]');
  if (!el) return '';
  if ('value' in el) return String(el.value || '').trim();
  return String(el.textContent || '').trim();
}

async function ensureSavedToAccount(){
  const meta = getBracketMetaFromUrl();

  // If we already have a bracket id (from URL or from local meta), treat it as existing.
  const existingId = meta.bracketId || state.bracketId;

  // Normalize the desired title (what the user typed in the top-left title box).
  // IMPORTANT: read from DOM so Save/Enter captures edits even without blur.
  const currentTitleRaw = (getBracketTitleFromDom() || state.bracketTitle || '').trim();
  const isDefaultTitle = !currentTitleRaw || [
    'My Bracket',
    'Untitled Bracket',
    'Untitled bracket',
    'Name Your Bracket Here',
    'Enter Bracket Name Here',
    ''
  ].includes(currentTitleRaw);
  let desiredTitle = currentTitleRaw;

  // If this is an existing bracket, just save data + title (no prompts, no creates).
  if(existingId){
    // Keep URL/meta in sync so future saves don't accidentally try to create again.
    state.bracketId = existingId;
    if(desiredTitle){ setUrlBracketId(existingId, desiredTitle); }
    try{
      await apiPut(`/api/bracket?id=${encodeURIComponent(existingId)}`, {
        id: existingId,
        title: desiredTitle || '',
        data: state.picks || {}
      });
      // Keep local state + meta consistent so the title doesn't "revert" on reload.
      const savedTitle = (desiredTitle || state.bracketTitle || '').trim();
      state.bracketTitle = savedTitle;
      saveMeta({ bracketId: existingId, bracketTitle: savedTitle });
      setUrlBracketId(existingId, savedTitle);
      setBracketTitleDisplay(savedTitle);
    }catch(e){
      // Surface duplicate name errors cleanly (409 NAME_TAKEN).
      if(e && e.data && (e.status === 409 || e.data.error === 'NAME_TAKEN')){
        throw new Error('NAME_TAKEN');
      }
      throw e;
    }
    return existingId;
  }

  // New bracket flow: only prompt if the user hasn't already typed a real name in the title box.
  if(isDefaultTitle){
    desiredTitle = await promptForBracketName(currentTitleRaw || '');
    if(!desiredTitle) throw new Error('CANCELLED');
  }

  while(true){
    // Create a new bracket row first (server enforces unique name per user).
    let create;
    try{
      create = await apiPost('/api/brackets', { title: desiredTitle, bracket_type: (state.bracket_type || 'bracketology') });
    }catch(e){
      // If the API returns 409 for duplicate name, ask again.
      if(e && e.status === 409){
        alert('You already have a bracket with that name. Please choose a different name.');
        desiredTitle = await promptForBracketName(desiredTitle);
        if(!desiredTitle) throw new Error('CANCELLED');
        continue;
      }
      throw e;
    }

    if(create && create.ok && create.id){
      const newId = create.id;

      // Persist new id + title in URL + local state
      state.bracketId = newId;
      state.bracketTitle = desiredTitle;
      saveMeta({ bracketId: newId, bracketTitle: desiredTitle });
      setUrlBracketId(newId, desiredTitle);
      setBracketTitleDisplay(desiredTitle);

      // Now save the actual bracket picks to the row.
      await apiPut(`/api/bracket?id=${encodeURIComponent(newId)}`, {
        id: newId,
        title: desiredTitle,
        data: state.picks || {}
      });

      return newId;
    }

    // Handle duplicate name (some older API responses use {error:'NAME_TAKEN'} without throwing)
    if(create && create.error === 'NAME_TAKEN'){
      alert('You already have a bracket with that name. Please choose a different name.');
      desiredTitle = await promptForBracketName(desiredTitle);
      if(!desiredTitle) throw new Error('CANCELLED');
      continue;
    }

    throw new Error((create && create.error) ? create.error : 'Could not create bracket');
  }
}

function scheduleAutosave(){
  if(!state.me) return;
  // Avoid autosaving before the bracket is created/named.
  if(!state.bracketId) return;
  const meta = getBracketMetaFromUrl();
  // Don't autosave a brand-new unsaved bracket (avoids popping name prompts).
  if(!meta.existingId) return;

  clearTimeout(state.autosaveTimer);
  // Debounced autosave to the user's account bracket.
  // Keep this lightweight; failures should not block UI.
  state.autosaveTimer = setTimeout(async ()=>{
    try{
      await ensureSavedToAccount();
    }catch(e){
      // Most likely unauthenticated or schema not ready; UI should still work.
    }
  }, 700);
}

function rulesHtmlBest(){
return `
  <div class="rulesInner">
    <div class="rulesHeader">
      <div class="rulesTitle">Rules <span class="muted">— Best Bracket</span></div>
      <div class="rulesBadge">🏆 10 points per correct pick</div>
    </div>

    <div class="rulesGrid">
      <div class="ruleItem">
        <b>Scoring</b>
        Every correct game pick = <b>10 points</b>. No extra weight for later rounds.
      </div>
      <div class="ruleItem">
        <b>Entry</b>
        You must be logged in. Choose a saved bracket (or use your current bracket) and enter.
      </div>
      <div class="ruleItem">
        <b>Tie-breaker</b>
        Enter the <b>combined score</b> of the National Championship game.
      </div>
      <div class="ruleItem">
        <b>Visibility</b>
        Leaderboards show a public link to each entry bracket as results update.
      </div>
    </div>
  </div>
`;
}

function rulesHtmlWorst(){
return `
  <div class="rulesInner">
    <div class="rulesHeader">
      <div class="rulesTitle">Rules <span class="muted">— Worst Bracket</span></div>
      <div class="rulesBadge">😈 score when your pick LOSES</div>
    </div>

    <div class="rulesGrid">
      <div class="ruleItem">
        <b>Scoring</b>
        You earn <b>10 points</b> when the team you picked to win actually <b>loses</b>.
      </div>
      <div class="ruleItem">
        <b>Stages</b>
        Stage 1 plays until the field reaches the <b>Sweet 16</b>, then Stage 2 unlocks. Final Four unlocks Stage 3.
      </div>
      <div class="ruleItem">
        <b>Leaderboard</b>
        Ranked by <b>total points across all stages</b> (Stage 1 + Stage 2 + Stage 3).
      </div>
      <div class="ruleItem">
        <b>Colors</b>
        <b>Green</b> = you earned a point (your pick lost). <b>Red</b> = your pick won (no point).
      </div>
    </div>
  </div>
`;
}

async function renderChallenges(){
  qs('#bestRules').innerHTML = rulesHtmlBest();
  qs('#worstRules').innerHTML = rulesHtmlWorst();

  await renderBestActions();
  await renderWorstActions();
  await renderBestLeaderboard();
  await renderWorstLeaderboard();
}

async function renderBestActions(){
  const mount = qs('#bestActions');
  mount.innerHTML='';
  if(!state.me){
    const b = el('button','primaryBtn');
    b.textContent='Sign in to enter Best Challenge';
    b.addEventListener('click', ()=>openAuth('signin'));
    mount.appendChild(b);
    return;
  }
  const row = el('div','challengeActions');
  // bracket selector
  const select = el('select','select');
  select.id = 'bestSelect';
  const opt0 = document.createElement('option');
  opt0.value='';
  opt0.textContent='Choose one of your saved brackets…';
  select.appendChild(opt0);

  try{
    const d = await api('/api/brackets', {method:'GET'});
    (d.brackets||[]).forEach(bk=>{
      const o=document.createElement('option');
      o.value=bk.id;
      o.textContent=bk.title || bk.id;
      select.appendChild(o);
    });
  }catch(e){}
  row.appendChild(select);

  const useCurrent = el('button','btn');
  useCurrent.textContent='Use current bracket';
  useCurrent.addEventListener('click', async ()=>{
    await enterBestWithCurrent();
  });

  const enterBtn = el('button','primaryBtn');
  enterBtn.textContent='Enter Best Challenge';
  enterBtn.addEventListener('click', async ()=>{
    const id = select.value;
    if(!id){ toast('Pick a saved bracket, or click “Use current bracket”.'); return; }
    await enterChallenge('best','pre', id);
  });

  row.appendChild(enterBtn);
  row.appendChild(useCurrent);
  mount.appendChild(row);
}

function ensureTiebreakerIfChampion(picks){
  if(!picks || !picks.CHAMPION) return true;
  const tb = picks.TIEBREAKER_TOTAL;
  if(tb!==null && tb!==undefined && tb!=='' && Number.isFinite(Number(tb))) return true;
  // Require user-entered tiebreaker (no prompts — keep UX stable on iOS Safari).
  toast('Please enter Tiebreaker: Total Points in Final.');
  try{
    const el = qs('#tiebreakerTotal');
    if(el){ el.focus(); el.scrollIntoView({behavior:'smooth', block:'center'}); }
  }catch(_e){}
  return false;
}

async function enterBestWithCurrent(){
  if(!state.me){ openAuth('signin'); return; }
  // must have champion + tiebreaker
  if(!state.picks.CHAMPION){ toast('Finish your bracket (pick a champion) first.'); showView('build'); return; }
  const picks = {...state.picks};
  if(!ensureTiebreakerIfChampion(picks)) return;
  const title = 'Best Challenge Entry';
  const bracket_type = state.bracket_type || 'bracketology';
  const d = await api('/api/brackets', {method:'POST', body: JSON.stringify({title, data:picks, bracket_type})});
  const id = d.id;
  await enterChallenge('best','pre', id);
  toast('Entered Best Bracket Challenge!');
  await renderBestLeaderboard();
}

async function enterChallenge(challenge, stage, bracket_id){
  try{
    await api('/api/challenge/enter', {method:'POST', body: JSON.stringify({challenge, stage, bracket_id})});
  }catch(e){
    toast(e?.message || 'Could not enter challenge.');
  }
}

function lbTableBest(rows){
  const wrap = el('div','lbTableWrap');
  const t = el('table','lbTable');
  // Rank tie marker counts
  const rankCounts = new Map();
  (rows||[]).forEach(r=>rankCounts.set(r.rank, (rankCounts.get(r.rank)||0)+1));
  const thead = document.createElement('thead');
  thead.innerHTML = `<tr>
    <th>Rank</th>
    <th>User</th>
    <th>Score</th>
    <th>Total Possible</th>
    <th>x/y</th>
    <th>%</th>
    <th>Champion</th>
    <th>Entry</th>
  </tr>`;
  t.appendChild(thead);
  const tb = document.createElement('tbody');

  const meId = state.me ? state.me.id : null;
  (rows||[]).forEach(r=>{
    const tr = document.createElement('tr');
    if(meId && r.user_id === meId) tr.classList.add('isMe');
    const pct = (r.pct*100).toFixed(1) + '%';
    const champ = r.champion ? r.champion.name : '—';
    const displayName = r.title || r.display_name || 'Bracket';
    const totalPossible = (r.total_possible!==undefined && r.total_possible!==null) ? Number(r.total_possible) : null;
    const link = `${location.origin}${location.pathname}?id=${encodeURIComponent(r.bracket_id)}&challenge=best`;
    const rankLabel = (rankCounts.get(r.rank)||0) > 1 ? `T-${r.rank}` : String(r.rank);
    tr.innerHTML = `
      <td class="lbRank">${rankLabel}</td>
      <td class="lbUser">${escapeHtml(displayName)}</td>
      <td class="lbScore">${r.score}</td>
      <td class="lbScore">${(totalPossible===null||Number.isNaN(totalPossible)) ? '—' : totalPossible}</td>
      <td class="lbPct"><span class="lbX">${r.x}</span><span class="lbSlash">/${r.y}</span></td>
      <td class="lbPct">${pct}</td>
      <td><span>${escapeHtml(champ)}</span></td>
      <td><a href="${link}">View</a></td>
    `;
    tb.appendChild(tr);
  });
  t.appendChild(tb);
  wrap.appendChild(t);
  return wrap;
}

function lbTableWorst(rows){
  const wrap = el('div','lbTableWrap');
  const t = el('table','lbTable');
  const rankCounts = new Map();
  (rows||[]).forEach(r=>rankCounts.set(r.rank, (rankCounts.get(r.rank)||0)+1));
  const thead = document.createElement('thead');
  thead.innerHTML = `<tr>
    <th>Rank</th>
    <th>User</th>
    <th>Total</th>
    <th>Total Possible</th>
    <th>S1</th>
    <th>S2</th>
    <th>S3</th>
    <th>x/y</th>
    <th>%</th>
    <th>Entries</th>
  </tr>`;
  t.appendChild(thead);
  const tb = document.createElement('tbody');

  const meId = state.me ? state.me.id : null;
  (rows||[]).forEach(r=>{
    const pct = (r.pct*100).toFixed(1) + '%';
    const displayName = r.display_name || r.title || 'Bracket';
    const totalPossible = (r.total_possible!==undefined && r.total_possible!==null) ? Number(r.total_possible) : null;
    const links = [];
    if(r.brackets?.pre) links.push(`<a href="${location.origin}${location.pathname}?id=${encodeURIComponent(r.brackets.pre)}&challenge=worst&stage=pre">S1</a>`);
    if(r.brackets?.r16) links.push(`<a href="${location.origin}${location.pathname}?id=${encodeURIComponent(r.brackets.r16)}&challenge=worst&stage=r16">S2</a>`);
    if(r.brackets?.f4) links.push(`<a href="${location.origin}${location.pathname}?id=${encodeURIComponent(r.brackets.f4)}&challenge=worst&stage=f4">S3</a>`);
    const tr = document.createElement('tr');
    if(meId && r.user_id === meId) tr.classList.add('isMe');
    const rankLabel = (rankCounts.get(r.rank)||0) > 1 ? `T-${r.rank}` : String(r.rank);
    tr.innerHTML = `
      <td class="lbRank">${rankLabel}</td>
      <td class="lbUser">${escapeHtml(displayName)}</td>
      <td class="lbScore">${r.score}</td>
      <td class="lbScore">${(totalPossible===null||Number.isNaN(totalPossible)) ? '—' : totalPossible}</td>
      <td>${r.stage1}</td>
      <td>${r.stage2}</td>
      <td>${r.stage3}</td>
      <td class="lbPct"><span class="lbX">${r.x}</span><span class="lbSlash">/${r.y}</span></td>
      <td class="lbPct">${pct}</td>
      <td>${links.join(' ') || '—'}</td>
    `;
    tb.appendChild(tr);
  });
  t.appendChild(tb);
  wrap.appendChild(t);
  return wrap;
}

function renderLbMeta(challenge, group, selectedGroupId){
  const bar = el('div','lbMetaBar');
  const left = el('div','lbMetaLeft');
  const right = el('div','lbMetaRight');
  const title = el('div','lbMetaTitle');
  const sub = el('div','lbMetaSub');

  if(selectedGroupId && group){
    title.textContent = `Group: ${group.name}`;
    const mc = Number(group.member_count||0);
    sub.textContent = `${mc} member${mc===1?'':'s'}`;
  }else{
    title.textContent = 'Overall standings';
    sub.textContent = challenge==='best'
      ? 'Best Bracket Challenge (pick winners)'
      : 'Worst Bracket Challenge (pick losers)';
  }


// Right side: hint + admin tools
right.innerHTML = '';
const hint = document.createElement('div');
hint.className = 'lbMetaHint';
hint.textContent = state.me ? 'Your row is highlighted.' : 'Sign in to highlight your row.';
right.appendChild(hint);

if(state.me && state.me.isAdmin){
  const btn = document.createElement('button');
  btn.className = 'btnMini';
  btn.textContent = 'Pending group upgrades';
  btn.onclick = ()=>openPendingUpgradesModal();
  right.appendChild(btn);
}
  left.appendChild(title);
  left.appendChild(sub);
  bar.appendChild(left);
  bar.appendChild(right);
  return bar;
}

async function renderBestLeaderboard(){
  await renderLeaderboardsForCurrentGroups();
}

async function renderWorstLeaderboard(){
  const mount = qs('#worstLeaderboard');
  if(!mount) return;
  mount.innerHTML = 'Loading…';
  try{
    const d = await api('/api/leaderboard?challenge=worst', {method:'GET'});
    mount.innerHTML='';
    mount.appendChild(lbTableWorst(d.leaderboard||[]));
  }catch(e){
    mount.innerHTML = 'Could not load leaderboard.';
  }

}


async function renderStatsBadge(){
  const badge = qs('#statsBadge');
  if(!badge) return;
  try{
    const d = await api('/api/stats', {method:'GET'});
    if(d.show_total_brackets){
      badge.style.display = '';
      badge.textContent = `Brackets made: ${Number(d.total_brackets||0).toLocaleString()}`;
    }else{
      badge.style.display = 'none';
    }
  }catch(e){
    badge.style.display='none';
  }
}

async function loadGroups(challenge){
  const d = await api(`/api/groups?challenge=${encodeURIComponent(challenge)}`, {method:'GET'});
  return d;
}

function populateSelect(sel, items, placeholder){
  sel.innerHTML = '';
  if(placeholder){
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = placeholder;
    sel.appendChild(opt);
  }
  items.forEach(it=>{
    const opt = document.createElement('option');
    opt.value = it.id;
    const mc = (it.member_count===null || it.member_count===undefined) ? null : Number(it.member_count);
    opt.textContent = mc===null ? it.name : `${it.name} (${mc})`;
    sel.appendChild(opt);
  });
}

async function initGroupsUI(challenge){
  const isBest = challenge==='best';
  const pubSel = qs(isBest ? '#bestPublicGroups' : '#worstPublicGroups');
  const joinBtn = qs(isBest ? '#bestJoinPublic' : '#worstJoinPublic');
  const nameIn = qs(isBest ? '#bestNewGroupName' : '#worstNewGroupName');
  const passIn = qs(isBest ? '#bestNewGroupPassword' : '#worstNewGroupPassword');
  const createBtn = qs(isBest ? '#bestCreateGroup' : '#worstCreateGroup');
  const mySel = qs(isBest ? '#bestMyGroupsSelect' : '#worstMyGroupsSelect');
  const leaveBtn = qs(isBest ? '#bestLeaveGroup' : '#worstLeaveGroup');

  if(!pubSel || !joinBtn || !createBtn || !mySel || !leaveBtn) return;

  const d = await loadGroups(challenge);
  const allGroups = (d.groups||[]);
  const publicGroups = allGroups.filter(g=>Number(g.is_public)===1);
  populateSelect(pubSel, publicGroups, "Select a public group");
  // My groups dropdown includes Overall
  const myGroupIds = new Set(d.my_groups||[]);
  const myGroups = allGroups.filter(g=>myGroupIds.has(g.id));
  populateSelect(mySel, myGroups, "Overall leaderboard");

  const groupFromUrl = new URLSearchParams(location.search).get('group');
  if(groupFromUrl){
    const g = (d.groups||[]).find(x=>x.id===groupFromUrl);
    if(g && g.challenge===challenge){
      // If already a member, select it
      if(myGroupIds.has(groupFromUrl)){
        mySel.value = groupFromUrl;
      }else{
        // Prompt to join private group (needs password if private)
        if(Number(g.is_public)===0){
          const pw = prompt(`Join private group "${g.name}". Enter password:`);
          if(pw){
            try{
              await api('/api/groups', {method:'POST', body: JSON.stringify({action:'join', group_id: g.id, password: pw})});
              setGroupNotice(challenge, null);
              toast('Joined group!');
              await showAffiliateModalAfterJoin(g);
              // refresh
              return await initGroupsUI(challenge);
            }catch(e){
              const needsPay = !!(e && e.data && e.data.needs_payment);
              if(needsPay) setGroupNotice(challenge, e.message, 'pending');
              else if(String(e.message||'').toLowerCase().includes('full')) setGroupNotice(challenge, e.message, 'full');
              else setGroupNotice(challenge, null);
              toast(e.message || 'Could not join group.');
            }
          }
        }else{
          try{
            await api('/api/groups', {method:'POST', body: JSON.stringify({action:'join', group_id: g.id})});
            setGroupNotice(challenge, null);
            toast('Joined group!');
            await showAffiliateModalAfterJoin(g);
            return await initGroupsUI(challenge);
          }catch(e){
            const needsPay = !!(e && e.data && e.data.needs_payment);
            if(needsPay) setGroupNotice(challenge, e.message, 'pending');
            else if(String(e.message||'').toLowerCase().includes('full')) setGroupNotice(challenge, e.message, 'full');
            else setGroupNotice(challenge, null);
            toast(e.message || 'Could not join group.');
          }
        }
      }
    }
  }

  joinBtn.onclick = async ()=>{
    const gid = pubSel.value;
    if(!gid){ toast('Pick a public group.'); return; }
    try{
      await api('/api/groups', {method:'POST', body: JSON.stringify({action:'join', group_id: gid})});
      setGroupNotice(challenge, null);
      toast('Joined group!');
      const g = publicGroups.find(x=>x.id===gid) || {id:gid, name: (publicGroups.find(x=>x.id===gid)||{}).name||'Group'};
      await showAffiliateModalAfterJoin(g);
      await initGroupsUI(challenge);
      await renderLeaderboardsForCurrentGroups();
    }catch(e){
      const needsPay = !!(e && e.data && e.data.needs_payment);
      if(needsPay) setGroupNotice(challenge, e.message, 'pending');
      else if(String(e.message||'').toLowerCase().includes('full')) setGroupNotice(challenge, e.message, 'full');
      else setGroupNotice(challenge, null);
      toast(e.message || 'Join failed.');
    }
  };

  createBtn.onclick = async ()=>{
    const name = nameIn.value.trim();
    const pw = passIn.value;
    if(!name || !pw){ toast('Enter group name + password.'); return; }
    try{
      const res = await api('/api/groups', {method:'POST', body: JSON.stringify({action:'create', challenge, name, password: pw})});
      const link = `${location.origin}${location.pathname}?group=${encodeURIComponent(res.group.id)}#${challenge}`;
      toast(`Created group! Share link + password. Link copied.`);
      try{ await navigator.clipboard.writeText(`${link}\nPassword: ${pw}`); }catch{}
      nameIn.value=''; passIn.value='';
      await initGroupsUI(challenge);
      await renderLeaderboardsForCurrentGroups();
    }catch(e){
      toast(e.message || 'Create failed.');
    }
  };

  leaveBtn.onclick = async ()=>{
    const gid = mySel.value;
    if(!gid){ toast('Select a group first.'); return; }
    try{
      await api('/api/groups', {method:'POST', body: JSON.stringify({action:'leave', group_id: gid})});
      toast('Left group.');
      await initGroupsUI(challenge);
      await renderLeaderboardsForCurrentGroups();
    }catch(e){
      toast(e.message || 'Leave failed.');
    }
  };

  
  if(settingsBtn){
    settingsBtn.onclick = async ()=>{
      const gid = mySel.value;
      if(!gid){ toast('Select one of your groups first.'); return; }
      const g = allGroups.find(x=>x.id===gid);
      if(!g || Number(g.is_public)===1){ toast('Only private groups have settings.'); return; }
      // Only creator can edit size
      if(!g.created_by || !state.me || Number(g.created_by)!==Number(state.me.id)){
        toast('Only the group creator can change group size.');
        return;
      }
      const memberCount = Number(g.member_count||0);
      const currentMax = Number(g.max_members||6);
      const tiers = [
        {max:6, label:'Up to 6 members (Free)', price:0},
        {max:12, label:'Up to 12 members ($5)', price:5},
        {max:25, label:'Up to 25 members ($10)', price:10},
        {max:50, label:'Up to 50 members ($25)', price:25},
        {max:9999, label:'51+ members ($50)', price:50},
      ];
      const overlay = document.createElement('div');
      overlay.className='modalOverlay';
      const opts = tiers.map(t=>`<option value="${t.max}" ${t.max===currentMax?'selected':''} ${t.max<currentMax?'disabled':''}>${t.label}</option>`).join('');
      overlay.innerHTML = `
        <div class="modalCard">
          <div class="modalTitle">Group settings</div>
          <div class="modalBody">
            <div class="modalText"><b>${escapeHtml(g.name)}</b></div>
            <div class="smallMuted">Members: ${memberCount}</div>
            <div class="smallMuted">Current max: ${currentMax}</div>
            <label class="fieldLabel">Allow up to</label>
            <select id="grpMaxSel" class="input">${opts}</select>
            <div class="tinyMuted">Private groups are free by default (up to 6). Upgrades are a one-time organizer fee per tournament.</div>
            <button class="btnPrimary fullWidth" id="grpSaveBtn">Save</button>
            <button class="btnGhost fullWidth" id="grpCancelBtn">Cancel</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.querySelector('#grpCancelBtn')?.addEventListener('click', ()=>overlay.remove());
      overlay.addEventListener('click', (e)=>{ if(e.target===overlay) overlay.remove(); });
      overlay.querySelector('#grpSaveBtn')?.addEventListener('click', async ()=>{
        const sel = overlay.querySelector('#grpMaxSel');
        const max = Number(sel.value||0);
        if(!max) return;
        try{
          const res = await api('/api/groups', {method:'POST', body: JSON.stringify({action:'set_max', group_id: gid, max_members: max})});
          overlay.remove();
          const price = Number(res.tier_price||0);
          if(price>0){
            const cfg = await loadPublicConfig();
            const base = (cfg && cfg.group_upgrade_checkout_url_base) ? String(cfg.group_upgrade_checkout_url_base) : '';
            const checkout = res.checkout_url || (base ? `${base}${base.includes("?")?"&":"?"}group=${encodeURIComponent(gid)}&max=${max}&price=${price}` : '');
            if(checkout){
              window.open(checkout, '_blank', 'noopener');
              toast(`Group updated ($${price}). Updated.`);
            }else{
              toast(`Group updated ($${price}).`);
            }
          }else{
            toast('Saved.');
          }
          await initGroupsUI(challenge);
          await renderLeaderboardsForCurrentGroups();
        }catch(e){
          toast(e.message || 'Could not save.');
        }
      });
    };
  }

mySel.onchange = async ()=>{
    await renderLeaderboardsForCurrentGroups();
  };
}

async function renderLeaderboardsForCurrentGroups(){
  const bestGroup = qs('#bestMyGroupsSelect')?.value || '';
  const worstGroup = qs('#worstMyGroupsSelect')?.value || '';
  // Only render the active view's board, but safe to render both
  try{
    const bestMount = qs('#bestLeaderboard');
    if(bestMount){
      bestMount.innerHTML='Loading…';
      const url = bestGroup ? `/api/leaderboard?challenge=best&group=${encodeURIComponent(bestGroup)}` : '/api/leaderboard?challenge=best';
      const d = await api(url, {method:'GET'});
      bestMount.innerHTML='';
      bestMount.appendChild(renderLbMeta('best', d.group, bestGroup));
      bestMount.appendChild(lbTableBest(d.leaderboard||[]));
    }
  }catch{}
  try{
    const worstMount = qs('#worstLeaderboard');
    if(worstMount){
      worstMount.innerHTML='Loading…';
      const url = worstGroup ? `/api/leaderboard?challenge=worst&group=${encodeURIComponent(worstGroup)}` : '/api/leaderboard?challenge=worst';
      const d = await api(url, {method:'GET'});
      worstMount.innerHTML='';
      worstMount.appendChild(renderLbMeta('worst', d.group, worstGroup));
      worstMount.appendChild(lbTableWorst(d.leaderboard||[]));
    }
  }catch{}
}


function stage2Unlocked(){
  const regions = ['REGION_SOUTH','REGION_EAST','REGION_WEST','REGION_MIDWEST'];
  for(const r of regions){
    for(let g=0; g<4; g++){
      if(!state.resultsMap[`${r}__R1__G${g}`]) return false;
    }
  }
  return true;
}

function stage3Unlocked(){
  const regions = ['REGION_SOUTH','REGION_EAST','REGION_WEST','REGION_MIDWEST'];
  for(const r of regions){
    if(!state.resultsMap[`${r}__R3__G0`]) return false;
  }
  return true;
}

function miniSlot(team, isWinner, onClick){
  const s = el('div','slot');
  if(!team){ s.classList.add('empty'); return s; }
  const seed = el('span','seed'); seed.textContent = team.seed;
  const name = el('span','name'); name.textContent = team.name;
  s.appendChild(seed); s.appendChild(name);
  if(isWinner) s.classList.add('winner');
  // Read-only safety: disable interaction in shared/admin views.
  if(!(state && state.readOnly)){
    s.addEventListener('click', onClick);
  }else{
    s.classList.add('readonly');
  }
  return s;
}

function applyPickResultClass(slotEl, pickedTeam, gameId, mode){
  const actual = state.resultsMap[gameId] || null;
  if(!actual || !pickedTeam) return;
  const pickedWinner = teamEq(pickedTeam, actual);
  if(mode==='worst'){
    if(!pickedWinner) slotEl.classList.add('correctPick'); else slotEl.classList.add('wrongPick');
  }else{
    if(pickedWinner) slotEl.classList.add('correctPick'); else slotEl.classList.add('wrongPick');
  }
}

function renderWorstStage2(picks, onUpdate){
  const wrap = el('div','bracket');
  const regions = ['REGION_SOUTH','REGION_EAST','REGION_WEST','REGION_MIDWEST'];
  regions.forEach(rKey=>{
    const box = el('div','regionCard');
    const h = el('div','regionHead'); h.textContent = rKey;
    box.appendChild(h);

    let t0 = state.resultsMap[`${rKey}__R1__G0`];
    let t1 = state.resultsMap[`${rKey}__R1__G1`];
    let t2 = state.resultsMap[`${rKey}__R1__G2`];
    let t3 = state.resultsMap[`${rKey}__R1__G3`];
    if(sweet16ModeEnabled() && (!t0 || !t1 || !t2 || !t3)){
      const ph = getPlaceholderSweet16Field(rKey);
      t0 = ph[0]; t1 = ph[1]; t2 = ph[2]; t3 = ph[3];
    }
    const s16a=[t0,t1], s16b=[t2,t3];
    const colWrap = el('div','rounds');
    const colS16 = el('div','roundCol');
    colS16.appendChild(el('div','roundTitle')).textContent='Sweet 16';
    const colE8 = el('div','roundCol');
    colE8.appendChild(el('div','roundTitle')).textContent='Elite 8';

    function renderGame(gameId, key, teams){
      const cur = picks[key]||null;
      const g = el('div','game');
      teams.forEach(team=>{
        const isWin = cur && teamEq(cur, team);
        const slot = miniSlot(team, isWin, ()=>{
          const np={...picks}; np[key]=team; // prune
          // if E8 pick exists but conflicts, clear
          if(key.endsWith('__R2__G0__winner') || key.endsWith('__R2__G1__winner')){
            const e8Key = `${rKey}__R3__G0__winner`;
            if(np[e8Key] && !teamEq(np[e8Key], teams[0]) && !teamEq(np[e8Key], teams[1])) delete np[e8Key];
          }
          onUpdate(np);
        });
        if(cur && teamEq(cur, team)) applyPickResultClass(slot, cur, gameId, 'worst');
        g.appendChild(slot);
      });
      return g;
    }

    const kA = `${rKey}__R2__G0__winner`;
    const kB = `${rKey}__R2__G1__winner`;
    colS16.appendChild(renderGame(`${rKey}__R2__G0`, kA, s16a));
    colS16.appendChild(renderGame(`${rKey}__R2__G1`, kB, s16b));

    // Elite 8 contenders depend on S16 picks
    const pA = picks[kA]||null;
    const pB = picks[kB]||null;
    const e8Teams = [pA, pB].filter(Boolean);
    const kE8 = `${rKey}__R3__G0__winner`;
    const gE8 = el('div','game');
    (e8Teams.length===2 ? e8Teams : [pA||t0, pB||t2]).forEach(team=>{
      const isWin = picks[kE8] && teamEq(picks[kE8], team);
      const slot = miniSlot(team, isWin, ()=>{
        const np={...picks}; np[kE8]=team; onUpdate(np);
      });
      if(picks[kE8] && teamEq(picks[kE8], team)) applyPickResultClass(slot, picks[kE8], `${rKey}__R3__G0`, 'worst');
      gE8.appendChild(slot);
    });
    colE8.appendChild(gE8);

    colWrap.appendChild(colS16);
    colWrap.appendChild(colE8);
    box.appendChild(colWrap);
    wrap.appendChild(box);
  });
  return wrap;
}

function renderLateStage2(picks, onUpdate){
  // Same as Worst Stage 2 bracket geometry, but scored as "best" (correct winners are green)
  const wrap = el('div','bracket');
  const regions = ['REGION_SOUTH','REGION_EAST','REGION_WEST','REGION_MIDWEST'];
  regions.forEach(rKey=>{
    const box = el('div','regionCard');
    const h = el('div','regionHead'); h.textContent = rKey;
    box.appendChild(h);

    let t0 = state.resultsMap[`${rKey}__R1__G0`];
    let t1 = state.resultsMap[`${rKey}__R1__G1`];
    let t2 = state.resultsMap[`${rKey}__R1__G2`];
    let t3 = state.resultsMap[`${rKey}__R1__G3`];
    if(sweet16ModeEnabled() && (!t0 || !t1 || !t2 || !t3)){
      const ph = getPlaceholderSweet16Field(rKey);
      t0 = ph[0]; t1 = ph[1]; t2 = ph[2]; t3 = ph[3];
    }
    const s16a=[t0,t1], s16b=[t2,t3];
    const colWrap = el('div','rounds');
    const colS16 = el('div','roundCol');
    colS16.appendChild(el('div','roundTitle')).textContent='Sweet 16';
    const colE8 = el('div','roundCol');
    colE8.appendChild(el('div','roundTitle')).textContent='Elite 8';

    function renderGame(gameId, key, teams){
      const cur = picks[key]||null;
      const g = el('div','game');
      teams.forEach(team=>{
        const isWin = cur && teamEq(cur, team);
        const slot = miniSlot(team, isWin, ()=>{
          const np={...picks}; np[key]=team;
          // prune downstream
          const e8Key = `${rKey}__R3__G0__winner`;
          if(np[e8Key] && !teamEq(np[e8Key], teams[0]) && !teamEq(np[e8Key], teams[1])) delete np[e8Key];
          // if final four picks exist but conflict, prune globally
          pruneInvalidPicks(np);
          onUpdate(np);
        });
        if(cur && teamEq(cur, team)) applyPickResultClass(slot, cur, gameId, 'best');
        g.appendChild(slot);
      });
      return g;
    }

    const kA = `${rKey}__R2__G0__winner`;
    const kB = `${rKey}__R2__G1__winner`;
    colS16.appendChild(renderGame(`${rKey}__R2__G0`, kA, s16a));
    colS16.appendChild(renderGame(`${rKey}__R2__G1`, kB, s16b));

    // Elite 8 contenders depend on S16 picks
    const pA = picks[kA]||null;
    const pB = picks[kB]||null;
    const e8Teams = [pA, pB].filter(Boolean);
    const kE8 = `${rKey}__R3__G0__winner`;
    const gE8 = el('div','game');
    (e8Teams.length===2 ? e8Teams : [pA||t0, pB||t2]).forEach(team=>{
      const isWin = picks[kE8] && teamEq(picks[kE8], team);
      const slot = miniSlot(team, isWin, ()=>{
        const np={...picks}; np[kE8]=team; pruneInvalidPicks(np); onUpdate(np);
      });
      if(picks[kE8] && teamEq(picks[kE8], team)) applyPickResultClass(slot, picks[kE8], `${rKey}__R3__G0`, 'best');
      gE8.appendChild(slot);
    });
    colE8.appendChild(gE8);

    colWrap.appendChild(colS16);
    colWrap.appendChild(colE8);
    box.appendChild(colWrap);
    wrap.appendChild(box);
  });
  return wrap;
}

function renderLateStage3(picks, onUpdate){
  // Same as Worst Stage 3, but scored as "best"
  const wrap = el('div','bracket');

  const col = el('div','finalBoard');
  const colFF = el('div','roundCol');
  colFF.appendChild(el('div','roundTitle')).textContent='Final Four';
  const colFinal = el('div','roundCol');
  colFinal.appendChild(el('div','roundTitle')).textContent='Final';
  const colChamp = el('div','roundCol');
  colChamp.appendChild(el('div','roundTitle')).textContent='Champion';

  const south = state.resultsMap['SOUTH__R3__G0'];
  const east  = state.resultsMap['EAST__R3__G0'];
  const west  = state.resultsMap['WEST__R3__G0'];
  const mid   = state.resultsMap['MIDWEST__R3__G0'];

  function game(gameId, key, teams){
    const g = el('div','game');
    teams.forEach(team=>{
      const isWin = picks[key] && teamEq(picks[key], team);
      const slot = miniSlot(team, isWin, ()=>{
        const np={...picks}; np[key]=team; pruneInvalidPicks(np); onUpdate(np);
      });
      if(picks[key] && teamEq(picks[key], team)) applyPickResultClass(slot, picks[key], gameId, 'best');
      g.appendChild(slot);
    });
    return g;
  }

  colFF.appendChild(game('FF__G0','FF__G0__winner',[south,east]));
  colFF.appendChild(game('FF__G1','FF__G1__winner',[west,mid]));

  const f1 = picks['FF__G0__winner'] || south;
  const f2 = picks['FF__G1__winner'] || west;
  colFinal.appendChild(game('FINAL','FINAL__winner',[f1,f2]));

  const champKey = 'CHAMPION';
  const champTeams = [picks['FINAL__winner']||f1].filter(Boolean);
  const gC = el('div','game');
  champTeams.forEach(team=>{
    const isWin = picks[champKey] && teamEq(picks[champKey], team);
    const slot = miniSlot(team, isWin, ()=>{
      const np={...picks}; np[champKey]=team; pruneInvalidPicks(np); onUpdate(np);
    });
    if(picks[champKey] && teamEq(picks[champKey], team)) applyPickResultClass(slot, picks['FINAL__winner']||team, 'FINAL', 'best');
    gC.appendChild(slot);
  });
  colChamp.appendChild(gC);

  col.appendChild(colFF); col.appendChild(colFinal); col.appendChild(colChamp);
  wrap.appendChild(col);
  return wrap;
}

function renderWorstStage3(picks, onUpdate){
  const wrap = el('div','bracket');
  const south = state.resultsMap['SOUTH__R3__G0'];
  const east  = state.resultsMap['EAST__R3__G0'];
  const west  = state.resultsMap['WEST__R3__G0'];
  const mid   = state.resultsMap['MIDWEST__R3__G0'];

  const col = el('div','rounds');
  const colFF = el('div','roundCol');
  colFF.appendChild(el('div','roundTitle')).textContent='Final Four';
  const colFinal = el('div','roundCol');
  colFinal.appendChild(el('div','roundTitle')).textContent='Final';
  const colChamp = el('div','roundCol');
  colChamp.appendChild(el('div','roundTitle')).textContent='Champion';

  function game(gameId, key, teams){
    const g = el('div','game');
    teams.forEach(team=>{
      const isWin = picks[key] && teamEq(picks[key], team);
      const slot = miniSlot(team, isWin, ()=>{
        const np={...picks}; np[key]=team;
        // prune downstream
        if(key.startsWith('FF__')){
          if(np['FINAL__winner'] && !teamEq(np['FINAL__winner'], teams[0]) && !teamEq(np['FINAL__winner'], teams[1])) delete np['FINAL__winner'];
          if(np['CHAMPION'] && np['FINAL__winner'] && !teamEq(np['CHAMPION'], np['FINAL__winner'])) delete np['CHAMPION'];
        }
        if(key==='FINAL__winner'){
          if(np['CHAMPION'] && !teamEq(np['CHAMPION'], team)) delete np['CHAMPION'];
        }
        onUpdate(np);
      });
      if(picks[key] && teamEq(picks[key], team)) applyPickResultClass(slot, picks[key], gameId, 'worst');
      g.appendChild(slot);
    });
    return g;
  }

  colFF.appendChild(game('FF__G0','FF__G0__winner',[south,east]));
  colFF.appendChild(game('FF__G1','FF__G1__winner',[west,mid]));

  const f1 = picks['FF__G0__winner'] || south;
  const f2 = picks['FF__G1__winner'] || west;
  colFinal.appendChild(game('FINAL','FINAL__winner',[f1,f2]));

  const champKey = 'CHAMPION';
  const champTeams = [picks['FINAL__winner']||f1].filter(Boolean);
  const gC = el('div','game');
  champTeams.forEach(team=>{
    const isWin = picks[champKey] && teamEq(picks[champKey], team);
    const slot = miniSlot(team, isWin, ()=>{
      const np={...picks}; np[champKey]=team; onUpdate(np);
    });
    // champion coloring uses FINAL result
    if(picks[champKey] && teamEq(picks[champKey], team)) applyPickResultClass(slot, picks['FINAL__winner']||team, 'FINAL', 'worst');
    gC.appendChild(slot);
  });
  colChamp.appendChild(gC);

  col.appendChild(colFF); col.appendChild(colFinal); col.appendChild(colChamp);
  wrap.appendChild(col);
  return wrap;
}

async function openWorstStage(stage){
  const mount = qs('#worstEntryMount');
  mount.innerHTML='';
  if(stage==='r16' && !stage2Unlocked()){ mount.innerHTML='<div class="pill">Stage 2 is locked until the real Sweet 16 is known.</div>'; return; }
  if(stage==='f4' && !stage3Unlocked()){ mount.innerHTML='<div class="pill">Stage 3 is locked until the real Final Four is known.</div>'; return; }

  let picks = loadDraftWorst(stage);
  const title = stage==='r16' ? 'Worst Challenge Stage 2 (Sweet 16 reset)' : 'Worst Challenge Stage 3 (Final Four reset)';

  const head = el('div','panelHead');
  head.innerHTML = `<h3>${stage==='r16' ? 'Stage 2 Entry' : 'Stage 3 Entry'}</h3><div class="lbSub">Pick the team you think will lose.</div>`;
  mount.appendChild(head);

  const bracket = (stage==='r16') ? renderWorstStage2(picks, (np)=>{ picks=np; saveDraftWorst(stage,picks); refreshWorstEntry(stage,picks); }) : renderWorstStage3(picks, (np)=>{ picks=np; saveDraftWorst(stage,picks); refreshWorstEntry(stage,picks); });
  mount.appendChild(bracket);

  const actions = el('div','challengeActions');
  const save = el('button','primaryBtn');
  save.textContent='Save & Enter this stage';
  save.addEventListener('click', async ()=>{
    const data = {...picks};
    // For stage3, if champion selected, ask tiebreaker
    if(stage==='f4' && data.CHAMPION){
      if(!ensureTiebreakerIfChampion(data)) return;
    }
    const bracket_type = state.bracket_type || 'bracketology';
    const d = await api('/api/brackets', {method:'POST', body: JSON.stringify({title, data, bracket_type})});
    await enterChallenge('worst', stage, d.id);
    toast('Entered Worst Challenge!');
    await renderWorstLeaderboard();
  });
  const close = el('button','btn');
  close.textContent='Clear entry';
  close.addEventListener('click', ()=>{
    clearDraftWorst(stage);
    mount.innerHTML='';
  });
  actions.appendChild(save);
  actions.appendChild(close);
  mount.appendChild(actions);
}

function refreshWorstEntry(stage,picks){
  // simply re-open stage view to refresh
  openWorstStage(stage);
}

function loadDraftWorst(stage){
  try{
    const raw = localStorage.getItem('bb_worst_'+stage);
    return raw ? JSON.parse(raw) : {};
  }catch{ return {}; }
}
function saveDraftWorst(stage,picks){
  try{ localStorage.setItem('bb_worst_'+stage, JSON.stringify(picks||{})); }catch{}
}
function clearDraftWorst(stage){
  try{ localStorage.removeItem('bb_worst_'+stage); }catch{}
}

async function renderWorstActions(){
  const mount = qs('#worstActions');
  mount.innerHTML='';
  if(!state.me){
    const b = el('button','primaryBtn');
    b.textContent='Sign in to enter Worst Challenge';
    b.addEventListener('click', ()=>openAuth('signin'));
    mount.appendChild(b);
    return;
  }

  const row = el('div','challengeActions');
  const s1 = el('button','primaryBtn');
  s1.textContent='Enter Stage 1 (through Round of 32)';
  s1.addEventListener('click', async ()=>{
    await enterWorstStage1FromCurrent();
  });

  const s2 = el('button','btn');
  s2.textContent='Enter Stage 2 (Sweet 16 reset)';
  s2.addEventListener('click', async ()=>{ await openWorstStage('r16'); });

  const s3 = el('button','btn');
  s3.textContent='Enter Stage 3 (Final Four reset)';
  s3.addEventListener('click', async ()=>{ await openWorstStage('f4'); });

  row.appendChild(s1);
  row.appendChild(s2);
  row.appendChild(s3);
  mount.appendChild(row);
}

async function enterWorstStage1FromCurrent(){
  if(!state.me){ openAuth('signin'); return; }
  // prune to allow picks only through Round of 32 (no Sweet16+)
  const picks = {...state.picks};
  Object.keys(picks).forEach(k=>{
    if(k.startsWith('FF__') || k.startsWith('FINAL') || k==='CHAMPION' || k==='TIEBREAKER_TOTAL') delete picks[k];
    // region rounds >=2
    const m = k.match(/__(R\d)__G\d+__winner$/);
    if(m){
      const r = Number(m[1].replace('R',''));
      if(r>=2) delete picks[k];
    }
  });
  const title = 'Worst Challenge Stage 1';
  const bracket_type = state.bracket_type || 'bracketology';
  const d = await api('/api/brackets', {method:'POST', body: JSON.stringify({title, data:picks, bracket_type})});
  await enterChallenge('worst','pre', d.id);
  toast('Entered Worst Challenge Stage 1!');
  await renderWorstLeaderboard();
}


async function openBracketsOverlay(){
  const ov = qs('#bracketsOverlay');
  ov.classList.remove('hidden');

  const list = qs('#bracketsList');
  list.innerHTML = '<div class="muted">Loading…</div>';

  if(!state.me){
    list.innerHTML = '<div class="muted">Sign in to view your saved brackets.</div>';
    return;
  }

  try{
    const d = await api('/api/brackets', { method:'GET' });
    const items = d.brackets || [];
    if(items.length === 0){
      list.innerHTML = '<div class="muted">No saved brackets yet.</div>';
      return;
    }
    list.innerHTML = '';
    items.forEach(b=>{
      const row = el('div','brRow');
      row.innerHTML = `
        <div class="brTitle">${escapeHtml(b.title || 'Enter Bracket Name Here')}</div>
        <div class="brMeta">${new Date(b.updated_at).toLocaleString()}</div>
        <button class="btn ghost smallBtn" data-open="${b.id}">Open</button>
        <button class="btn ghost smallBtn" data-share="${b.id}">Share</button>
      `;
      list.appendChild(row);
    });
    qsa('[data-open]', list).forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const id = btn.getAttribute('data-open');
        await loadBracketFromServer(id);
        toast('Loaded bracket');
        closeBracketsOverlay();
      });
    });
    qsa('[data-share]', list).forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const id = btn.getAttribute('data-share');
        state.bracketId = id;
        saveMeta({ bracketId:id, bracketTitle: state.bracketTitle });
        openShareOverlay();
      });
    });
  }catch(e){
    list.innerHTML = '<div class="muted">Could not load your brackets.</div>';
  }
}

function closeBracketsOverlay(){
  qs('#bracketsOverlay').classList.add('hidden');
  try{ showView('build'); }catch(e){}
  try{ window.scrollTo({top:0, behavior:'smooth'}); }catch(e){ window.scrollTo(0,0); }
}

async function loadBracketFromServer(id){
  const d = await api(`/api/bracket?id=${encodeURIComponent(id)}`, { method:'GET' });
  state.bracketId = d.bracket.id;
  state.sharedOwnerId = d.bracket.user_id;
  state.bracketTitle = d.bracket.title || '';
  state.bracket_type = d.bracket.bracket_type || 'bracketology';
  state.bracketType = state.bracket_type;

  saveMeta({ bracketId: state.bracketId, bracketTitle: state.bracketTitle });
  // Ensure the visible title matches the latest value from D1, not stale local meta.
  setBracketTitleDisplay(state.bracketTitle);
  setUrlBracketId(state.bracketId, state.bracketTitle);
  state.undoStack = [];
  state.picks = d.bracket.data || {};
  saveLocal(state.picks);
  renderAll();
  updateUndoUI();
}

// -------------------- Featured --------------------
async function loadFeatured(){
  const grid = qs('#featuredGrid');
  if(!grid) return;
  grid.innerHTML = '<div class="card"><div class="cardBody">Loading…</div></div>';

  try{
    const d = await api('/api/featured', { method:'GET' });
    const items = d.featured || [];
    if(items.length === 0){
      grid.innerHTML = '<div class="card"><div class="cardBody">No featured brackets yet.</div></div>';
      return;
    }
    grid.innerHTML = '';
    items.forEach(it=>{
      const c = el('div','card');
      c.innerHTML = `
        <div class="cardTitle">${escapeHtml(it.title || 'Featured Bracket')}</div>
        <div class="cardBody">${escapeHtml(it.caption || '')}</div>
        <div class="row" style="gap:8px;flex-wrap:wrap">
          <a class="btn ghost smallBtn" href="/?id=${encodeURIComponent(it.bracket_id)}&readonly=1" target="_blank" rel="noopener">Open</a>
        </div>
      `;
      grid.appendChild(c);
    });
  }catch(e){
    grid.innerHTML = '<div class="card"><div class="cardBody">Could not load featured brackets.</div></div>';
  }
}

async function submitFeatured(){
  if(!state.me){
    openAuth();
    toast('Sign in to submit a bracket.');
    return;
  }
  // Choose from user's brackets
  const d = await api('/api/brackets', { method:'GET' });
  const items = d.brackets || [];
  if(items.length === 0){
    toast('No saved brackets yet. Finish a bracket first.');
    return;
  }
  const menu = items.map((b,i)=>`${i+1}) ${b.title}`).join('\n');
  const pick = prompt('Submit which bracket?\n' + menu + '\n\nEnter a number:');
  const n = parseInt(pick||'',10);
  if(!n || n<1 || n>items.length) return;
  const bracketId = items[n-1].id;
  const caption = prompt('Caption (optional):') || '';
  await api('/api/feature', { method:'POST', body: JSON.stringify({ bracket_id: bracketId, caption })});
  toast('Submitted! Admin will approve it.');
}

// -------------------- Admin: All Brackets + Featured Review --------------------
let __adminBracketsOffset = 0;

async function loadAdminBracketsView(reset=true){
  if(!(state && state.me && state.me.isAdmin)) return;
  const mount = qs('#adminBracketsMount');
  const btnMore = qs('#adminBracketsMore');
  const status = qs('#adminBracketsStatus');
  if(!mount) return;

  const limit = 100;
  if(reset){
    __adminBracketsOffset = 0;
    mount.innerHTML = '';
  }
  if(status) status.textContent = 'Loading…';
  if(btnMore) btnMore.disabled = true;

  try{
    const d = await api(`/api/admin/brackets?limit=${limit}&offset=${__adminBracketsOffset}`, { method:'GET' });
    const rows = d.brackets || [];

    if(reset){
      mount.innerHTML = '';
      const table = el('table','adminTable');
      table.innerHTML = `
        <thead>
          <tr>
            <th>Bracket</th>
            <th>User</th>
            <th>Type</th>
            <th>Updated</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="adminBracketsBody"></tbody>
      `;
      mount.appendChild(table);
    }

    const body = qs('#adminBracketsBody');
    if(!body) return;

    rows.forEach(r=>{
      const tr = document.createElement('tr');
      const t = String(r.title || 'Enter Bracket Name Here');
      const email = String(r.user_email || ('User #' + (r.user_id||'')));
      const typ = String(r.bracket_type || 'bracketology');
      const upd = r.updated_at ? new Date(r.updated_at).toLocaleString() : '';
      const href = `/?id=${encodeURIComponent(r.id)}&readonly=1`;
      tr.innerHTML = `
        <td>${escapeHtml(t)}</td>
        <td class="muted">${escapeHtml(email)}</td>
        <td>${escapeHtml(typ)}</td>
        <td class="muted">${escapeHtml(upd)}</td>
        <td><a class="btn ghost smallBtn" href="${href}" target="_blank" rel="noopener">Open</a></td>
      `;
      body.appendChild(tr);
    });

    __adminBracketsOffset += rows.length;
    if(status) status.textContent = rows.length ? '' : (reset ? 'No brackets found.' : 'No more results.');
    if(btnMore) btnMore.disabled = (rows.length < limit);
  }catch(e){
    if(status) status.textContent = 'Could not load brackets.';
    if(btnMore) btnMore.disabled = false;
  }
}

async function loadAdminFeaturedReview(){
  if(!(state && state.me && state.me.isAdmin)) return;

  const statusNode = qs('#adminFeaturedStatus');
  const mounts = {
    pending: qs('#adminFeaturedPending'),
    approved: qs('#adminFeaturedApproved'),
    rejected: qs('#adminFeaturedDenied')
  };

  // Clear mounts
  Object.values(mounts).forEach(n=>{ if(n) n.innerHTML = ''; });
  if(statusNode) statusNode.textContent = 'Loading…';

  // Format without seconds (matches your preference)
  const fmtNoSeconds = (dstr)=>{
    try{
      if(!dstr) return '';
      const d = new Date(dstr);
      return d.toLocaleString(undefined, { year:'numeric', month:'numeric', day:'numeric', hour:'numeric', minute:'2-digit' });
    }catch(e){ return ''; }
  };

  const renderList = (st, items)=>{
    const mount = mounts[st];
    if(!mount) return;

    if(!items || items.length===0){
      mount.innerHTML = `<div class="muted" style="padding:10px 2px;">No ${st === 'rejected' ? 'denied' : st} submissions.</div>`;
      return;
    }

    items.forEach(req=>{
      const title = String(req.bracket_title || req.title || 'Untitled Bracket');
      const email = String(req.user_email || '');
      const when = fmtNoSeconds(req.created_at);
      const href = `/?id=${encodeURIComponent(req.bracket_id)}&readonly=1`;

      const card = el('div','bracketCard');
      card.classList.add('featuredCard'); // reuse featured/mybrackets visual language
      card.innerHTML = `
        <div class="bracketCardTop">
          <div class="bracketTitle">${escapeHtml(title)}</div>
          <div class="bracketMeta">${escapeHtml(email)}${email ? ' • ' : ''}${escapeHtml(when)}</div>
        </div>
        <div class="row" style="gap:10px; margin-top:10px; flex-wrap:wrap;">
          <a class="btn ghost smallBtn openBtnBlack" href="${href}" target="_blank" rel="noopener">Open (read-only)</a>
          ${st === 'pending' ? `
            <button class="btnOutline approveBtn smallBtn" data-approve="${req.id}">Approve</button>
            <button class="btnOutline denyBtn smallBtn" data-deny="${req.id}">Deny</button>
          ` : ``}
        </div>
      `;
      mount.appendChild(card);
    });
  };

  try{
    const [p,a,r] = await Promise.all([
      api(`/api/feature?status=pending`, { method:'GET' }),
      api(`/api/feature?status=approved`, { method:'GET' }),
      api(`/api/feature?status=rejected`, { method:'GET' })
    ]);

    renderList('pending', (p && p.requests) || []);
    renderList('approved', (a && a.requests) || []);
    renderList('rejected', (r && r.requests) || []);

    if(statusNode) statusNode.textContent = '';
  }catch(e){
    if(statusNode) statusNode.textContent = 'Could not load featured submissions.';
  }

  // Wire actions (only pending cards have them)
  qsa('[data-approve]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const id = btn.getAttribute('data-approve');
      btn.disabled = true;
      try{
        await api('/api/feature', { method:'PUT', body: JSON.stringify({ id, status:'approved' }) });
        toast('Approved.');
        await loadAdminFeaturedReview();
      }catch(e){
        toast('Could not approve.');
        btn.disabled = false;
      }
    });
  });

  qsa('[data-deny]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const id = btn.getAttribute('data-deny');
      btn.disabled = true;
      try{
        await api('/api/feature', { method:'PUT', body: JSON.stringify({ id, status:'rejected' }) });
        toast('Denied.');
        await loadAdminFeaturedReview();
      }catch(e){
        toast('Could not deny.');
        btn.disabled = false;
      }
    });
  });
}


// -------------------- Rendering --------------------
function renderBubble(){
  // Bubble panel removed (Home is bracket-only). Keep this as a safe no-op.
  const stamp = qs('#stamp');
  const lfi = qs('#lastFourIn');
  const ffo = qs('#firstFourOut');
  if(!stamp || !lfi || !ffo) return;
  stamp.textContent = `Updated: ${nowStamp()}`;
  lfi.innerHTML='';
  LAST_FOUR_IN_LIST.forEach(t=>{ const li=el('li'); li.textContent=t; lfi.appendChild(li); });
  ffo.innerHTML='';
  FIRST_FOUR_OUT_LIST.forEach(t=>{ const li=el('li'); li.textContent=t; ffo.appendChild(li); });
}

function teamLogoUrl(teamName){
  const slug = String(teamName||'')
    .toLowerCase()
    .replace(/&/g,'and')
    .replace(/\./g,'')
    .replace(/'/g,'')
    .replace(/[()]/g,'')
    .replace(/\s+/g,'-')
    .replace(/[^a-z0-9-]/g,'')
    .replace(/-+/g,'-')
    .replace(/^-|-$/g,'');
  return slug ? `./logos/${slug}.svg` : '';
}

function computeTops(matchH, gap, gamesCount){
  // Returns per-round top offsets until a single game remains.
  // (8 -> 4 -> 2 -> 1 for a region; 32 -> ... -> 1 for unified mobile)
  const tops = [];
  let prev = Array.from({length: gamesCount}, (_,i)=> i*(matchH+gap));
  tops.push(prev);
  while(prev.length > 1){
    const arr = [];
    for(let i=0;i<Math.floor(prev.length/2);i++){
      const a = prev[i*2];
      const b = prev[i*2+1];
      arr.push(Math.round((a+b)/2));
    }
    tops.push(arr);
    prev = arr;
  }
  return tops;
}

// Region column geometry (desktop + mobile). Keep it compact and consistent.
// Keep JS geometry in sync with CSS (desktop game boxes are 120px wide).
const GAME_BOX_W = 120;
const COL_STEP = 120;     // box width + padding
// Region column left offsets (for mobile auto-scroll + header alignment)
const ROUND_LEFTS = [0, COL_STEP, COL_STEP*2, COL_STEP*3, COL_STEP*4];

function renderRegion(r, picks, opts={}){
  const card = el('div','regionCard');

  // Desktop only: mirror the right-side regions (East/Midwest) so they
  // start on the far RIGHT with Round of 64 and funnel LEFT to Final 4.
  const isMobile = window.matchMedia && window.matchMedia('(max-width: 820px)').matches;
  const forcedMirror = (opts && typeof opts.isMirror === 'boolean') ? opts.isMirror : null;
  const isMirror = (!isMobile) && (forcedMirror!==null ? forcedMirror : (r.name === 'East' || r.name === 'Midwest'));

  const startRound = (opts && Number.isFinite(opts.startRound)) ? opts.startRound : 0;
  const roundsToRender = (opts && Number.isFinite(opts.maxRounds)) ? opts.maxRounds : 4;
  const ALL_ROUND_LABELS = ['Round of 64','Round of 32','Sweet 16','Elite 8'];
  const roundLabels = ALL_ROUND_LABELS.slice(startRound, startRound + roundsToRender);


  // Region header + per-round labels (requested: show round names aligned above
  // each column, and keep the region name visible on mobile when the bracket
  // auto-scrolls between rounds).
  const header = el('div','regionHeader');
  if(isMirror) header.classList.add('mirror');
  const nm = el('div','regionName');
  nm.textContent = r.name;
  const roundRow = el('div','regionRoundRow');
  // Keep header labels aligned to tightened columns.
  const headerLefts = isMirror
    ? roundLabels.map((_,i)=> (roundLabels.length-1-i)*COL_STEP)
    : roundLabels.map((_,i)=> i*COL_STEP);
  for(let i=0;i<roundLabels.length;i++){
    const sp = el('div','regionRoundLabel');
    sp.textContent = roundLabels[i];
    sp.style.left = (headerLefts[i] + 10) + 'px';
    roundRow.appendChild(sp);
  }

  // Ensure header border includes all round labels (incl. Elite 8) on mobile.
  const headerW = (roundLabels.length * COL_STEP) + 140;
  header.style.minWidth = headerW + 'px';
  roundRow.style.minWidth = headerW + 'px';
  // In mirrored regions, show round labels first and the region name on the far right
  // (slightly lower) to avoid overlapping.
  if(isMirror){
    header.appendChild(roundRow);
    header.appendChild(nm);
  }else{
    header.appendChild(nm);
    header.appendChild(roundRow);
  }
  const scroller = el('div','geo regionGeo');
  scroller.dataset.region = r.name;
  const canvas = el('div','geoCanvas');

  // Mobile: put the region header INSIDE the horizontal scroller so it moves
  // with the bracket when swiping anywhere within the region.
  if(isMobile){
    header.classList.add('inGeo');
    scroller.appendChild(header);
    scroller.appendChild(canvas);
  }else{
    card.appendChild(header);
    scroller.appendChild(canvas);
  }
  card.appendChild(scroller);

  const base = listToSeedArray(r.teams);

  // Slightly more compact on desktop so the full bracket fits better
  const matchH = 72, gap = 10;
  const gamesCountByStart = {0:8,1:4,2:2,3:1};
  const tops = computeTops(matchH, gap, gamesCountByStart[startRound] || 8);

  // Bring columns closer together so users scroll less on desktop.
  const roundLefts = isMirror
    ? roundLabels.map((_,i)=> (roundLabels.length-1-i)*COL_STEP)
    : roundLabels.map((_,i)=> i*COL_STEP);

  const canvasH = tops[0][tops[0].length-1] + matchH;
  canvas.style.height = `${canvasH}px`;
  canvas.style.minHeight = `${canvasH}px`;

  // Build + render each displayed round col
  for(let displayIdx=0; displayIdx<roundLabels.length; displayIdx++){
    const roundIdx = startRound + displayIdx;
    const games = buildRoundTeams(r.key, base, picks, roundIdx);
    const col = el('div','roundCol');
    col.style.left = `${roundLefts[displayIdx]}px`;
    col.style.height = `${canvasH}px`;

    // Round names are now shown in the region header row (black) so we don't
    // duplicate them inside the scrolling columns.

    games.forEach((pair, gIdx)=>{
      const game = el('div','game'); game.style.top = `${tops[displayIdx][gIdx]}px`;
      const curWinner = picks[wKey(r.key, roundIdx, gIdx)] || null;

      pair.forEach((team)=>{
        const s = el('div','slot');
        if(!team){
          s.classList.add('empty');
          s.innerHTML = `<span class="seed">—</span><span class="team">—</span>`;
        }else{
          if(curWinner && teamEq(curWinner, team)) s.classList.add('winner');
          const gameId = `${r.key}__R${roundIdx}__G${gIdx}`;
          const actual = state.resultsMap[gameId] || null;
          const mode = (opts && opts.scoringMode) ? opts.scoringMode : (state.shareContext.challenge || null);
          if(actual && curWinner && teamEq(curWinner, team)){
            const pickedWinner = teamEq(curWinner, actual);
            if(mode==='worst'){
              if(!pickedWinner) s.classList.add('correctPick'); else s.classList.add('wrongPick');
            }else if(mode==='best'){
              if(pickedWinner) s.classList.add('correctPick'); else s.classList.add('wrongPick');
            }
          }
          s.innerHTML = `<span class="seed">${team.seed}</span><span class="team">${escapeHtml(team.name)}</span>`;
          s.addEventListener('click', ()=>{
            if (bracketsLockedNow()){
              toast('Brackets are locked (tournament has started).');
              return;
            }
            if((opts && opts.readOnly) || state.readOnly) return;
            const basePicks = (opts && opts.picksRef) ? opts.picksRef : state.picks;
            const np = {...basePicks};
            np[wKey(r.key, roundIdx, gIdx)] = team;
            pruneInvalidPicks(np);
            if(opts && typeof opts.onUpdate==='function') {
              // Some bracket variants pass their own updater; ensure undo works
              // by pushing through commitPicks when they update the main state.
              opts.onUpdate(np);
            } else {
              // Main bracket pick update: use commitPicks so Undo can revert
              // individual picks and random-picks snapshots consistently.
              commitPicks(np, 'pick');
            }
;
          });
        }
        game.appendChild(s);
      });

      col.appendChild(game);
    });

    canvas.appendChild(col);
  }

  // Regional champ display (to Final Four)

  // Prevent extra dead space on desktop.
  // Tighten the region canvas width so there's not excessive blank space
  // at the outer edges (especially on the mirrored/right-side regions).
  // Column left positions are 0, 120, 240, 360 so total width is 3 steps + 1 box.
  const regionW = (COL_STEP * 3) + GAME_BOX_W + 20;
  canvas.style.width = `${regionW}px`;
  canvas.style.minWidth = `${regionW}px`;

  return { card, scroller };
}

function regionalChamp(regionKey, picks){ return picks[wKey(regionKey,3,0)] || null; }

function renderFinalRounds(picks){
  const mountFF = qs('#finalFourBoard');
  const mountChamp = qs('#championBoard');
  if(mountFF) mountFF.innerHTML='';
  if(mountChamp) mountChamp.innerHTML='';

  // Figure out which regions are on the left/right halves on desktop (layout may change over time).
  const halves = getRegionKeyHalvesFromDom();
  const leftA = regionalChamp(halves.leftKeys[0], picks);
  const leftB = regionalChamp(halves.leftKeys[1], picks);
  const rightA = regionalChamp(halves.rightKeys[0], picks);
  const rightB = regionalChamp(halves.rightKeys[1], picks);

// Final Four: show the 4 region champs. Clicking a champ advances them to the Finals
  // (Finals picks are stored as FF__G0__winner and FF__G1__winner).
  if(mountFF){
    const layout = el('div','final4Layout');

    const leftCol = el('div','final4Col final4ColLeft');
    const rightCol= el('div','final4Col final4ColRight');

    // Left half of bracket (desktop_toggle: two left regions) -> FF__G0__winner
    // Right half of bracket (two right regions) -> FF__G1__winner
    const winnerKeys = ['FF__G0__winner','FF__G1__winner'];

    // helper to build a clickable team slot (sets semifinal winner)
    const makeTeamSlot = (team, winnerKey, allowPick)=>{
      const s = el('div','slot');
      if(!team){
        s.classList.add('empty');
        s.innerHTML = `<span class="seed">—</span><span class="team">—</span>`;
        return s;
      }

      const curWinner = state.picks[winnerKey] || null;
      if(curWinner && teamEq(curWinner, team)) s.classList.add('winner');

      const baseId = String(winnerKey||'').replace(/__winner$/,'');
      const actual = state.resultsMap[baseId] || null;
      const mode = state.shareContext.challenge || null;
      if(actual && curWinner && teamEq(curWinner, team)){
        const pickedWinner = teamEq(curWinner, actual);
        if(mode==='worst'){
          if(!pickedWinner) s.classList.add('correctPick'); else s.classList.add('wrongPick');
        }else if(mode==='best'){
          if(pickedWinner) s.classList.add('correctPick'); else s.classList.add('wrongPick');
        }
      }

      s.innerHTML = `<span class="seed">${team.seed}</span><span class="team">${escapeHtml(team.name)}</span>`;
      if(allowPick){
        s.addEventListener('click', ()=>{
          if(bracketsLockedNow()){
            toast('Brackets are locked (tournament has started).');
            return;
          }
          if(state.readOnly) return;
          const np = {...state.picks};
          np[winnerKey] = team;
          pruneInvalidPicks(np);
          commitPicks(np, 'pick');
        });
      }
      return s;
    };

    // left column: two LEFT-side regions
    leftCol.appendChild(makeTeamSlot(leftA,  winnerKeys[0], true));
    leftCol.appendChild(makeTeamSlot(leftB,  winnerKeys[0], true));

    // right column: two RIGHT-side regions
    rightCol.appendChild(makeTeamSlot(rightA, winnerKeys[1], true));
    rightCol.appendChild(makeTeamSlot(rightB, winnerKeys[1], true));
layout.appendChild(leftCol);
    layout.appendChild(rightCol);

    mountFF.appendChild(layout);
  }

  // Champion: show Finals picks to the left/right of the champion pick.
  if(mountChamp){
    const winnerKeys = ['FF__G0__winner','FF__G1__winner'];
    const leftFinal  = picks[winnerKeys[0]] || null;
    const rightFinal = picks[winnerKeys[1]] || null;
    const finalWinner = picks['FINAL__winner'] || null;

    const row = el('div','champRow');
    const sideL = el('div','champSide');
    const main  = el('div','champMain');
    const sideR = el('div','champSide');

    const makeFinalist = (team, isLeft)=>{
      const s = el('div','slot final4WinnerSlot');
      if(!team){
        s.classList.add('empty');
        s.innerHTML = `<span class="seed">—</span><span class="team">—</span>`;
        return s;
      }
      s.innerHTML = `<span class="seed">${team.seed}</span><span class="team">${escapeHtml(team.name)}</span>`;
      // clicking a finalist selects the overall champion
      s.addEventListener('click', ()=>{
        if(bracketsLockedNow()){
          toast('Brackets are locked (tournament has started).');
          return;
        }
        if(state.readOnly) return;
        const other = picks[isLeft ? winnerKeys[1] : winnerKeys[0]] || null;
        if(!other){
          toast('Pick both Final Four winners first.');
          return;
        }
        const np = {...state.picks};
        np['FINAL__winner'] = team;
        pruneInvalidPicks(np);
        commitPicks(np, 'pick');
      });
      return s;
    };

    sideL.appendChild(makeFinalist(leftFinal, true));
    sideR.appendChild(makeFinalist(rightFinal, false));

    const box = el('div','championBox');
    const name = el('div','championName');
    if(finalWinner){
      name.textContent = `${finalWinner.seed} ${finalWinner.name || ''}`.trim();
    }else{
      name.textContent = '—';
    }
    box.appendChild(name);
    main.appendChild(box);

    row.appendChild(sideL);
    row.appendChild(main);
    row.appendChild(sideR);
    mountChamp.appendChild(row);
  }
}

function renderUnifiedMobileBracket(picks, resultsMap){
  const sec = qs('#ncaaFullSection');
  if(!sec) return;

  // Hide desktop pieces on mobile
  const rr = qs('#regionsRow'); if(rr) rr.style.display = 'none';
  const rm = qs('#regionsMount'); if(rm) rm.style.display = 'none';
  const f4 = qs('#finalFourSection'); if(f4) f4.style.display = 'none';
  const champ = qs('#championSection'); if(champ) champ.style.display = 'none';

  let mount = qs('#mobileUnifiedMount');
  if(!mount){
    mount = el('div','');
    mount.id = 'mobileUnifiedMount';
    sec.prepend(mount);
  }
  mount.innerHTML = '';

  const regionOrder = ['South','West','East','Midwest'];
  const regionsByName = {};
  (state.regions||[]).forEach(r=> regionsByName[r.name]=r);

  const matchH = 72, gap = 10;
  const colW = 120, colGap = 34;
  const tops = computeTops(matchH, gap, 32); // 32->16->8->4->2->1

  const scroller = el('div','geo mobileUnifiedGeo');
  scroller.style.overflowX = 'auto';
  scroller.style.paddingBottom = '14px';
  scroller.dataset.region = 'Unified';

  // Keep a canvas placeholder for existing styling hooks
  const canvas = el('div','geoCanvas');
  scroller.appendChild(canvas);

  const content = el('div','geoContent');
  content.style.position = 'relative';
  content.style.height = (tops[0][tops[0].length-1] + matchH + 90) + 'px';
  content.style.minWidth = ((7*colW) + (6*colGap) + 40) + 'px';
  scroller.appendChild(content);

  // Round titles
  const titles = ['Round of 64','Round of 32','Sweet 16','Elite 8','Final 4','Finals','Champion'];
  titles.forEach((t, idx)=>{
    const d = el('div','roundTitle');
    d.textContent = t;
    d.style.position = 'absolute';
    d.style.left = (idx*(colW+colGap)) + 'px';
    d.style.top = '0px';
    d.style.width = colW + 'px';
    d.style.textAlign = 'center';
    d.style.fontSize = '12px';
    d.style.fontWeight = '800';
    d.style.color = '#fff';
    content.appendChild(d);
  });

  // Region labels (left column)
  const regionStarts = { South:0, West:8, East:16, Midwest:24 };
  regionOrder.forEach(rn=>{
    const lbl = el('div','mobileRegionLabel');
    lbl.textContent = rn;
    lbl.style.position = 'absolute';
    lbl.style.left = '0px';
    lbl.style.top = (tops[0][regionStarts[rn]] + 24) + 'px';
    lbl.style.width = colW + 'px';
    lbl.style.paddingLeft = '6px';
    lbl.style.fontSize = '12px';
    lbl.style.fontWeight = '900';
    lbl.style.color = '#fff';
    content.appendChild(lbl);
  });

  function teamToText(t){
    if(!t) return '';
    if(typeof t === 'string') return t;
    const seed = (t.seed!=null && t.seed!=='') ? String(t.seed) : '';
    const name = t.name!=null ? String(t.name) : '';
    return seed ? (seed + ' ' + name) : name;
  }

  function fillSlotEl(slotEl, team, winnerTag, side){
    slotEl.textContent = teamToText(team) || '';
    slotEl.classList.remove('winner','loser');
    if(winnerTag){
      if(winnerTag===side) slotEl.classList.add('winner');
      else slotEl.classList.add('loser');
    }
  }

  function renderMatch(colIdx, topPx, key, pair){
    const g = el('div','game');
    g.style.position = 'absolute';
    g.style.left = (colIdx*(colW+colGap)) + 'px';
    g.style.top = (topPx + 28) + 'px';
    g.style.width = colW + 'px';

    const top = el('div','slot');
    const bot = el('div','slot');
    top.dataset.k = key; top.dataset.t = 'top';
    bot.dataset.k = key; bot.dataset.t = 'bot';
    g.appendChild(top); g.appendChild(bot);

    const winnerTag = resultsMap && resultsMap[key] ? resultsMap[key].winner : null;
    fillSlotEl(top, pair && pair[0], winnerTag, 'top');
    fillSlotEl(bot, pair && pair[1], winnerTag, 'bot');

    // Picking (same as desktop) – but NO auto-scroll / auto-shift.
    [top,bot].forEach(slotEl=>{
      slotEl.addEventListener('click', ()=>{
        selectPick(key, slotEl.dataset.t);
        renderAll();
      });
    });

    content.appendChild(g);
  }

  // Render regional rounds columns 0..3
  regionOrder.forEach(rn=>{
    const r = regionsByName[rn];
    if(!r) return;
    const base = listToSeedArray(r.teams);

    // Round of 64 (8 games)
    const pairs0 = buildRoundTeams(r, base, picks, 0);
    for(let gi=0; gi<8; gi++){
      const key = wKey(r,0,gi);
      renderMatch(0, tops[0][regionStarts[rn]+gi], key, pairs0[gi]);
    }

    // Round of 32 (4 games)
    const pairs1 = buildRoundTeams(r, base, picks, 1);
    for(let gi=0; gi<4; gi++){
      const key = wKey(r,1,gi);
      renderMatch(1, tops[1][(regionStarts[rn]/2)+gi], key, pairs1[gi]);
    }

    // Sweet 16 (2 games)
    const pairs2 = buildRoundTeams(r, base, picks, 2);
    for(let gi=0; gi<2; gi++){
      const key = wKey(r,2,gi);
      renderMatch(2, tops[2][(regionStarts[rn]/4)+gi], key, pairs2[gi]);
    }

    // Elite 8 (1 game)
    const pairs3 = buildRoundTeams(r, base, picks, 3);
    const key3 = wKey(r,3,0);
    renderMatch(3, tops[3][(regionStarts[rn]/8)], key3, pairs3[0]);
  });

  // Final Four + Finals + Champion
  // Pairing is based on LEFT vs RIGHT halves of the bracket (not region names).
  const halves = getRegionKeyHalvesFromDom();
  const leftChampA  = picks[wKey(halves.leftKeys[0],3,0)]  || null;
  const leftChampB  = picks[wKey(halves.leftKeys[1],3,0)]  || null;
  const rightChampA = picks[wKey(halves.rightKeys[0],3,0)] || null;
  const rightChampB = picks[wKey(halves.rightKeys[1],3,0)] || null;

  const ffPairs = [
    [leftChampA,  leftChampB],   // LEFT half
    [rightChampA, rightChampB],  // RIGHT half
  ];

  for(let gi=0; gi<2; gi++){
    const key = 'FF__G' + gi + '__winner';
    renderMatch(4, tops[4][gi], key, ffPairs[gi]);
  }

  const finalsPair = [picks['FF__G0__winner']||null, picks['FF__G1__winner']||null];
  renderMatch(5, tops[5][0], 'FINAL__winner', finalsPair);

  // No single Champion box. Champion is inferred from FINAL__winner.

  mount.appendChild(scroller);
}


function renderChallengeCallout(){
  const mount = qs('#challengeCallout');
  if(!mount) return;
  mount.innerHTML = `
    <h4>Bracket Challenges</h4>
    <div class="lbSub">Want to compete? Enter the Best Bracket Challenge (pick winners) or the Worst Bracket Challenge (pick losers). You’ll need an account to appear on the leaderboard.</div>
    <div class="challengeActions" style="margin-top:10px">
      <button class="primaryBtn" id="goBest">Go to Best Challenge</button>
      <button class="btn" id="goWorst">Go to Worst Challenge</button>
    </div>
  `;
  qs('#goBest')?.addEventListener('click', ()=>showView('best'));
  qs('#goWorst')?.addEventListener('click', ()=>showView('worst'));
}


function sweet16Set(){
  if(sweet16ModeEnabled()) return true;
  const regions = ['REGION_SOUTH','REGION_EAST','REGION_WEST','REGION_MIDWEST'];
  return regions.every(r=>{
    return [0,1,2,3].every(g=>!!state.resultsMap[`${r}__R1__G${g}`]);
  });
}

function final4Set(){
  const regions = ['REGION_SOUTH','REGION_EAST','REGION_WEST','REGION_MIDWEST'];
  return regions.every(r=>!!state.resultsMap[`${r}__R3__G0`]);
}

function championSet(){
  return !!state.resultsMap['FINAL'];
}

function currentNCAAPhase(){
  if(championSet()) return 'post';
  if(final4Set()) return 'final4';
  if(sweet16Set()) return 'sweet16';
  return 'full';
}

function renderNCAALateSweet16(picks){
  const mount = qs('#ncaaLateMount');
  mount.innerHTML='';
  const title = qs('#ncaaLateTitle');
  const sub = qs('#ncaaLateSub');
  title.textContent = 'NCAA Sweet 16 Bracket';
  sub.textContent = (sweet16ModeEnabled() && !state.resultsMap['REGION_SOUTH__R1__G0']) ? 'Top 4 seeds placeholder — make picks from Sweet 16 to champion.' : 'Actual Sweet 16 field — make picks from here to champion.';
  const bracket = renderLateStage2(picks, (np)=>{ commitPicks(np,'pick'); });
  mount.appendChild(bracket);
}

function renderNCAALateFinal4(picks){
  const mount = qs('#ncaaLateMount');
  mount.innerHTML='';
  const title = qs('#ncaaLateTitle');
  const sub = qs('#ncaaLateSub');
  title.textContent = 'NCAA Final Four Bracket';
  sub.textContent = 'Actual Final Four field — make your final picks.';
  const bracket = renderLateStage3(picks, (np)=>{ commitPicks(np,'pick'); });
  mount.appendChild(bracket);
}

function setSectionVisible(id, show){
  const el = qs(id);
  if(!el) return;
  if(show) el.classList.remove('hidden');
  else el.classList.add('hidden');
}

function renderAll(){
  setSeasonBar();
  renderBubble();
  renderChallengeCallout();

  const isBracketPage = document.body.classList.contains('page-bracket') || location.pathname.endsWith('bracket.html');
  let phase = currentNCAAPhase();
  // On bracket.html, always render the bracket section (even during Sweet 16 / Final Four phases).
  if(isBracketPage && phase !== 'full') phase = 'full';

  // Home page doesn't have the separate "late stage" NCAA section mounts.
  // To keep Sweet 16 mode stable (and match bracket.html rendering), render inside the
  // existing full bracket layout but starting at Sweet 16.
  if(!isBracketPage && sweet16ModeEnabled() && phase !== 'full') phase = 'full';

  if(sweet16ModeEnabled()){
    state.picks = ensurePlaceholderToSweet16(state.picks);
  }

  // Show/hide core NCAA bracket sections
  setSectionVisible('#ncaaFullSection', phase==='full' || isBracketPage);
  setSectionVisible('#ncaaLateSection', !isBracketPage && (phase==='sweet16' || phase==='final4'));

  // Next sports panels appear starting at Sweet 16 and remain
  const showNext = (!isBracketPage) && (phase==='sweet16' || phase==='final4' || phase==='post');
  setSectionVisible('#nextSportsPanel', showNext);
  setSectionVisible('#preNbaSection', showNext);
  setSectionVisible('#preNhlSection', showNext);

  if(phase==='full'){
    // Mobile: render a single unified bracket (no per-region boxes, no auto-shift)
    // Mobile: render the standard full bracket (with horizontal scroll via CSS).
// Preserve mobile scroll positions across re-render (prevents jitter).
    if(isMobile()){
      try{ state.ui.pageScrollY = window.scrollY || window.pageYOffset || 0; }catch(_e){}
      const scs = Array.from(document.querySelectorAll('.geo.regionGeo, .geo.mobileUnifiedGeo'));
      scs.forEach(s=>{
        const key = s.dataset.region || '';
        if(key) state.ui.regionScrollLeft[key] = s.scrollLeft || 0;
      });
      const ff = document.querySelector('#ffScroller');
      if(ff) state.ui.regionScrollLeft['Final Four'] = ff.scrollLeft || 0;
    }

    // Regions (full pre-selection)
    const scrollers = [];
    REGIONS.forEach(r=>{
      const mount = qs(`#region-${r.name}`);
      mount.innerHTML='';
      const isRightSide = !!(mount && mount.closest && mount.closest('.deskCol.right'));
      const baseOpts = sweet16ModeEnabled()?{startRound:2,maxRounds:2}:undefined;
      const opts = baseOpts ? {...baseOpts, isMirror:isRightSide} : {isMirror:isRightSide};
      const { card, scroller } = renderRegion(r, state.picks, opts);
      mount.appendChild(card);
      scrollers.push(scroller);
    });
    renderFinalRounds(state.picks);
  // Phase 4: update Submit for Featured CTA
  try{ phase4UpdateFeatureCTA(); }catch(_e){}

    // Restore scroll positions after re-render.
    if(isMobile()){
      const scs2 = Array.from(document.querySelectorAll('.geo.regionGeo, .geo.mobileUnifiedGeo'));
      scs2.forEach(s=>{
        const key = s.dataset.region || '';
        if(!key) return;
        const saved = state.ui.regionScrollLeft[key];
        if(saved!==undefined && saved!==null) s.scrollLeft = saved;
      });
      const ff2 = document.querySelector('#ffScroller');
      if(ff2){
        const saved = state.ui.regionScrollLeft['Final Four'];
        if(saved!==undefined && saved!==null) ff2.scrollLeft = saved;
      }
      // Also keep the page where the user is vertically (prevents jump back up on iOS Safari).
      try{
        const y = state.ui.pageScrollY;
        if(y!==undefined && y!==null) window.scrollTo(0, y);
      }catch(_e){}

      /* === REAPPLY_SCROLL_AFTER_RENDER ===
         Some mobile browsers adjust scroll after focus/reflow following a click.
         Re-apply saved scroll positions on the next tick to keep the user stable.
      */
      try{
        setTimeout(()=>{
          try{
            const scs3 = Array.from(document.querySelectorAll('.geo.regionGeo, .geo.mobileUnifiedGeo'));
            scs3.forEach(s=>{
              const key = s.dataset.region || '';
              if(!key) return;
              const saved = state.ui.regionScrollLeft[key];
              if(saved!==undefined && saved!==null) s.scrollLeft = saved;
            });
            const ff3 = document.querySelector('#ffScroller');
            if(ff3){
              const saved = state.ui.regionScrollLeft['Final Four'];
              if(saved!==undefined && saved!==null) ff3.scrollLeft = saved;
            }
          }catch(_e){}
          try{
            const y = state.ui.pageScrollY;
            if(y!==undefined && y!==null) window.scrollTo(0, y);
          }catch(_e){}
        }, 0);
      }catch(_e){}
    }


  }else{
    // Clear full bracket mounts
    REGIONS.forEach(r=>{
      const mount = qs(`#region-${r.name}`);
      if(mount) mount.innerHTML='';
    });
    const ff = qs('#finalFourBoard'); if(ff) ff.innerHTML='';

    if(phase==='sweet16') renderNCAALateSweet16(state.picks);
    if(phase==='final4') renderNCAALateFinal4(state.picks);
    if(phase==='post'){
      const mount = qs('#ncaaLateMount'); if(mount) mount.innerHTML='';
    }
  }

  setupRoundBar();
  maybeAutoShiftMobile();
}
function overallRoundComplete(roundIdx){
  // roundIdx 0..3 for region rounds; 4=final four; 5=final; 6=champion
  if(roundIdx <= 3){
    for(const r of REGIONS){
      const needed = [8,4,2,1][roundIdx];
      for(let g=0; g<needed; g++){
        if(!state.picks[wKey(r.key, roundIdx, g)]) return false;
      }
    }
    return true;
  }
  if(roundIdx === 4) return !!(state.picks['FF__G0__winner'] && state.picks['FF__G1__winner']);
  if(roundIdx === 5) return !!state.picks['FINAL__winner'];
  if(roundIdx === 6) return !!state.picks['CHAMPION'];
  return false;
}

let lastAutoShiftIdx = 0;
function maybeAutoShiftMobile(){
  // Disabled: auto-shifting on mobile was causing glitches.
  // Keep the bracket position stable and user-controlled.
  return;
  if(!isMobile()) return;
  // ESPN-like: when an entire round is complete across all regions, shift to next column.
  const scrollers = qsa('.geo.regionGeo');
  const nextRound = overallRoundComplete(0) ? (overallRoundComplete(1) ? (overallRoundComplete(2) ? (overallRoundComplete(3) ? 4 : 3) : 2) : 1) : 0;
  // Only shift forward when a full round becomes complete. This prevents the
  // “move a little each pick then snap back” jitter.
  if (nextRound <= lastAutoShiftIdx) return;
  lastAutoShiftIdx = nextRound;
  // For rounds 0-3, we scroll within each region.
  // For the Final 4 (after Elite 8), we bring the Final 4 board into view.
  if (nextRound === 4){
    const ff = document.getElementById('finalFourBoard');
    if (ff) {
      try{ ff.scrollIntoView({ behavior:'smooth', block:'nearest' }); }catch{}
    }
    const ffScroller = document.getElementById('ffScroller');
    if (ffScroller) {
      try{ ffScroller.scrollTo({ left: 0, behavior:'smooth' }); }catch{}
    }
    return;
  }

  const targetLeft = ROUND_LEFTS[Math.min(nextRound, 3)];
  // Sync-scroll all region scrollers only (avoid touching Final 4 / Champion panels)
  scrollers.forEach(s=>{
    try{ s.scrollTo({ left: targetLeft, behavior:'smooth' }); }catch{}
  });
}

// Sticky round bar shows active round on mobile
function setupRoundBar(){
  const roundBar = qs('#roundBar');
  if(!roundBar) return;

  const labelForLeft = (x) => {
    // Use column step sizing (COL_STEP) so labels stay correct even if widths change.
    // 0=R64, 1=R32, 2=S16, 3=E8, 4=F4
    const step = (typeof COL_STEP === 'number' && COL_STEP > 0) ? COL_STEP : 220;
    const idx = Math.max(0, Math.min(4, Math.round(x / step)));
    return ['Round of 64','Round of 32','Sweet 16','Elite 8','Final 4'][idx] || 'Round of 64';
  };

  const update = () => {
    // Find the most "active" scroller by intersection (or first one)
    const scrollers = qsa('.geo.regionGeo');
    let best = scrollers[0];
    let bestRect = null;
    scrollers.forEach(s=>{
      const r = s.getBoundingClientRect();
      if(!bestRect || Math.abs(r.top) < Math.abs(bestRect.top)) { best = s; bestRect = r; }
    });
    const left = best ? best.scrollLeft : 0;
    const region = (best && best.dataset && best.dataset.region) ? best.dataset.region : '';
    const roundLabel = labelForLeft(left);
    // On mobile, show region name again whenever the bracket shifts rounds.
    roundBar.textContent = region ? `${region} — ${roundLabel}` : roundLabel;
  };

  if(!setupRoundBar._init){
    setupRoundBar._init = true;
    window.addEventListener('scroll', update, {passive:true});
    window.addEventListener('resize', update);
    qsa('.geo').forEach(s=> s.addEventListener('scroll', update, {passive:true}));
  }
  update();
  updateTiebreakerUI();

}

// -------------------- Share --------------------
function openShareOverlay(){
  const ov = qs('#shareOverlay');
  const sum = qs('#shareSummary');
  const champ = state.picks['CHAMPION'] || null;
  sum.textContent = champ ? `Champion: ${champ.name}` : 'Make a champion pick to share.';

  // If saved to account, mark public on the server so the share link works for everyone.
  if(state.me && state.bracketId){
    api('/api/share', { method:'POST', body: JSON.stringify({ bracket_id: state.bracketId })})
      .catch(()=>{});
  }

  ov.classList.remove('hidden');
}

function closeShareOverlay(){ qs('#shareOverlay').classList.add('hidden'); }

function shareUrl(){
  const u = new URL(location.href);
  if(state.bracketId){
    u.searchParams.set('id', state.bracketId);
  }
  return u.toString();
}

function shareText(){
  const champ = state.picks['CHAMPION'] || null;
  const base = champ ? `My projected champ: ${champ.name}` : 'My projected bracket on BracketologyBuilder';
  return `${base}\n${shareUrl()}`;
}

// -------------------- Navigation tabs --------------------
function viewFromHash(hash){
  const h = String(hash||'').replace(/^#/, '').trim().toLowerCase();
  if(!h) return null;
  if(h === 'home') return 'build';
  // Direct view ids
  if(['build','best','worst','best2','worst2','featured','upcoming','adminbrackets','adminfeatured'].includes(h)) return h;
  // Common aliases
  if(h === 'bracket') return 'build';
  return null;
}

function viewFromQuery(){
  try{
    const tab = new URLSearchParams(location.search).get('tab');
    if(!tab) return null;
    const t = String(tab).trim().toLowerCase();
    if(t === 'home') return 'build';
    if(['build','best','worst','best2','worst2','featured','upcoming','adminbrackets','adminfeatured'].includes(t)) return t;
  }catch(e){}
  return null;
}

function setHashForView(viewName){
  const map = {
    build: '#home',
    best: '#best',
    worst: '#worst',
    best2: '#best2',
    worst2: '#worst2',
    featured: '#featured',
    upcoming: '#upcoming',
    adminbrackets: '#adminbrackets',
    adminfeatured: '#adminfeatured'
  };
  const h = map[viewName] || '#home';
  // Use replaceState to avoid jump/scroll and keep back button sane.
  try{ history.replaceState(null, '', h); }catch(e){ location.hash = h; }
}

function showView(name){
  if(!OFFICIAL_BRACKET_LIVE && (name === 'best' || name === 'worst')){
    try{ toast('Challenges can only be played once the official bracket comes out.'); }catch(e){}
    name = 'build';
  }

  // Admin views require admin session.
  if((name === 'adminbrackets' || name === 'adminfeatured') && !(state && state.me && state.me.isAdmin)){
    try{ toast('Not authorized.'); }catch(e){}
    name = 'build';
  }

  const views = ['build','best','worst','best2','worst2','featured','upcoming','adminbrackets','adminfeatured'];
  views.forEach(v=>{
    const node = qs('#view-'+v);
    if(!node) return;
    const isActive = (v === name);
    node.classList.toggle('hidden', !isActive);
    // Extra safety: hard-hide inactive views to prevent any layout/CSS
    // quirks from leaving them visible.
    node.style.display = isActive ? '' : 'none';
  });
  qsa('.navLink').forEach(a=>a.classList.toggle('active', a.dataset.view===name));
  state.view = name;
  if(name==='featured') loadFeatured();
  if(name==='best' || name==='worst') renderChallenges();
  if(name==='adminbrackets') loadAdminBracketsView().catch(()=>{});
  if(name==='adminfeatured') loadAdminFeaturedReview().catch(()=>{});

  // UX: when a view contains the "Get Challenge Reminders" input, focus it automatically
  // so the blinking cursor is already in the box.
  focusEmailAlertInput(name);
  try{ bindLeadFormsForPage(); }catch(_e){}
}

function focusEmailAlertInput(viewName){
  const idMap = {
    best2: 'remindEmailBest2',
    worst2: 'remindEmailWorst2',
    upcoming: 'remindEmailUpcoming'
  };
  const id = idMap[viewName];
  if(!id) return;
  const el = qs('#'+id);
  if(!el) return;
  // Defer until after DOM updates / view display toggles.
  setTimeout(()=>{
    // Only focus if the element is visible (prevents weird focus jumps)
    const rect = el.getBoundingClientRect();
    const visible = rect.width > 0 && rect.height > 0;
    if(!visible) return;
    try{ el.focus({ preventScroll: true }); }
    catch(e){ try{ el.focus(); }catch(_e){} }
  }, 50);
}

function initNav(){
  qsa('.navLink').forEach(a=>{
    a.addEventListener('click', (ev)=>{
      const href = a.getAttribute('href') || '';
      // Allow normal navigation for real pages (e.g., my-brackets.html)
      if(href && !href.startsWith('#')) return;
      ev.preventDefault();
      showView(a.dataset.view);
      setHashForView(a.dataset.view);
    });
  });

  // Mobile-friendly dropdowns: keep sub-items hidden until the user taps the parent
  const drops = qsa('.navDrop');
  // Ensure dropdowns start closed (Safari/iOS can sometimes restore a prior hover/open state)
  drops.forEach(d=>d.classList.remove('open'));
  const closeAll = (except=null)=>{
    drops.forEach(d=>{ if(d!==except) d.classList.remove('open'); });
  };
  qsa('.navDropBtn').forEach(btn=>{
    btn.addEventListener('click', (ev)=>{
      // If dropdown lives inside the SPA (hash-less), prevent navigation
      ev.preventDefault();
      ev.stopPropagation();
      const drop = btn.closest('.navDrop');
      if(!drop) return;
      const willOpen = !drop.classList.contains('open');
      closeAll(drop);
      drop.classList.toggle('open', willOpen);
    });
  });
  document.addEventListener('click', ()=>closeAll(null));
}

function updateChallengeAvailability(){
  const ids = ['homeChallengeMsg','bestChallengeMsg','worstChallengeMsg'];
  ids.forEach(id=>{ const el = qs('#'+id); if(el) el.classList.toggle('hidden', OFFICIAL_BRACKET_LIVE); });
}


// -------------------- Helpers --------------------
function escapeHtml(str){
  return String(str||'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

// -------------------- Init --------------------
document.addEventListener('DOMContentLoaded', async ()=>{
  await loadPublicConfig();
  updateChallengeAvailability();
  const IS_HOME = (location.pathname.endsWith('index.html') || location.pathname === '/' || location.pathname === '');

  // Determine which bracket "type" this page is creating/saving.
  // Priority: explicit URL params > Sweet 16 mode (home only) > Official live > default.
  try {
    const qs = new URLSearchParams(location.search);
    const isHome = IS_HOME;
    if (qs.get('second') === '1') state.bracket_type = 'second_chance';
    else if (qs.get('official') === '1') state.bracket_type = 'official';
    else if (isHome && sweet16ModeEnabled()) state.bracket_type = 'second_chance';
    else if (OFFICIAL_BRACKET_LIVE) state.bracket_type = 'official';
    else state.bracket_type = 'bracketology';
  } catch {
    state.bracket_type = OFFICIAL_BRACKET_LIVE ? 'official' : 'bracketology';
  }

  // Load local picks + meta
  // Home page should ALWAYS start as a fresh bracket (never resume the last bracket).
  if(IS_HOME){
    state.picks = {};
    state.bracketId = null;
    state.bracketTitle = '';
    saveLocal(state.picks);
    saveMeta({ bracketId: null, bracketTitle: '' });
  }else{
    state.picks = loadLocal();
    const meta = loadMeta();
    state.bracketId = meta.bracketId || null;
    state.bracketTitle = meta.bracketTitle || '';
  }

  // If Sweet 16 mode is enabled, lock in placeholder early-round winners so the bracket starts at Sweet 16.
  if(sweet16ModeEnabled()){
    state.picks = ensurePlaceholderToSweet16(state.picks);
    saveLocal(state.picks);
  }

  // If creating a new bracket, start untitled and ask for a name later (on My Brackets)
  if (location.pathname.endsWith('bracket.html') && new URLSearchParams(location.search).get('new')==='1') {
    state.bracketId = null;
    state.bracketTitle = '';
    saveMeta({ bracketId: null, bracketTitle: '' });
  }

  // Render title + enable inline rename
  setBracketTitleDisplay(state.bracketTitle);
  initBracketTitleInlineRename();

  initNav();

  // Support deep-links like index.html#upcoming or /?tab=upcoming.
  // This also prevents the "sometimes it sends me back to Home" issue when
  // navigating in from standalone pages (best-challenge.html, worst-challenge.html).
  const initialView = viewFromQuery() || viewFromHash(location.hash);
  if(initialView){
    showView(initialView);
    setHashForView(initialView);
  }

  window.addEventListener('hashchange', ()=>{
    const v = viewFromHash(location.hash);
    if(v) showView(v);
  });

  // Lead capture forms
  bindLeadFormsForPage();
  // Reminder link on challenge pages
  document.addEventListener('click', async (e)=>{
    const link = e.target.closest('a.remindLink');
    if(!link) return;
    e.preventDefault();
    const which = link.getAttribute('data-remind') || '';
    await handleChallengeReminder(which);
  });
  try { await refreshMe(); } catch (e) {

  /* === AUTO_OPEN_AUTH_FROM_HASH ===
     Allow other pages (Best/Worst challenge pages) to redirect users to Home and auto-open auth modal:
     - index.html#signin opens Sign in
     - index.html#signup opens Sign up
  */
  try{
    const h = (location.hash || '').toLowerCase();
    if(h === '#signin' || h === '#signup'){
      // Only if auth overlay exists on this page
      const ov = document.querySelector('#authOverlay');
      if(ov){
        openAuth(h === '#signup' ? 'signup' : 'signin');
        // Clear hash so refresh doesn't reopen
        history.replaceState(null, '', location.pathname + location.search);
      }
    }
  }catch(_e){}
    console.warn('refreshMe failed', e);
    toast('Sign-in services temporarily unavailable. You can still fill out a bracket.');
  }
  try { await loadResults(); } catch (e) {
    console.warn('loadResults failed', e);
  }
  setInterval(() => { loadResults().catch(()=>{}); }, 20000);

  // If url includes id, load that bracket
  const u = new URL(location.href);
  const id = u.searchParams.get('id') || u.searchParams.get('bracketId');
  const roParam = u.searchParams.get('readonly');
  const ch = u.searchParams.get('challenge');
  const st = u.searchParams.get('stage');
  if(ch) state.shareContext.challenge = String(ch);
  if(st) state.shareContext.stage = String(st);

  if(roParam === '1') state.readOnly = true;

  if(id){
    try{ await loadBracketFromServer(id); }catch(e){ console.warn(e); }
    // If viewing someone else's shared bracket, disable edits
    if(state.sharedOwnerId && (!state.me || state.me.id !== state.sharedOwnerId)) state.readOnly = true;
  }

  applyReadOnlyUI();

  renderAll();

  /* === AUTO_RANDOM_NEW_BRACKET (init hook) ===
     When user clicks "Create new bracket with random picks" from My Brackets,
     they land on bracket.html?new=1&random=1.

     Some pages/loads can render before the region DOM is fully mounted, so we:
     - trigger on initial load
     - use a small timeout retry
     - only auto-fill if there are no picks yet
  */
  try {
    const spAuto = new URLSearchParams(location.search);
    const wantsRandom = (spAuto.get('random') === '1');
    const isNew = (spAuto.get('new') === '1');

    // Detect a bracket build page by DOM (more robust than pathname)
    const isBracketBuild = !!document.querySelector('#region-South, #region-East, #finalFourBoard');

    const meta = getBracketMetaFromUrl();
    const hasExisting = !!(meta && meta.bracketId);

    const hasAnyPicks = (() => {
      const pk = state.picks || {};
      // If there is at least one winner key or FF/Final/Champion key, treat as filled
      return Object.keys(pk).some(k => k.includes('__winner') || k === 'FINAL__winner' || k === 'CHAMPION');
    })();

    const tryAutoFill = () => {
      try {
        const meta2 = getBracketMetaFromUrl();
        const hasExisting2 = !!(meta2 && meta2.bracketId);
        const pk = state.picks || {};
        const filled = Object.keys(pk).some(k => k.includes('__winner') || k === 'FINAL__winner' || k === 'CHAMPION');
        if (isBracketBuild && wantsRandom && isNew && !hasExisting2 && !filled) {
          fillRandomPicks(); // commits + re-renders
        }
      } catch(_e) {}
    };

    if (isBracketBuild && wantsRandom && isNew && !hasExisting && !hasAnyPicks) {
      // Immediate attempt
      tryAutoFill();
      // Retry shortly in case DOM mounts late
      setTimeout(tryAutoFill, 60);
      setTimeout(tryAutoFill, 200);
    }
  } catch (_e) {}


  // Mobile-only UI tweak:
  // - Put Random Picks + Undo on the same row
  // - Move the bracket title box below that row (so it isn't directly above Undo)
  try {
    if (window.matchMedia && window.matchMedia('(max-width: 820px)').matches) {
      const titleInput = document.getElementById('bracketPageTitle');
      const randomBtn = document.getElementById('randomPicksBtnTop');
      const undoBtn = document.getElementById('undoBtnTop');

      if (titleInput && randomBtn && undoBtn) {
        const randomRow = randomBtn.closest('.bracketTitleRow');
        if (randomRow && undoBtn.parentElement !== randomRow) {
          randomRow.appendChild(undoBtn);
        }

        if (randomRow) {
          const titleRow = document.createElement('div');
          titleRow.className = 'bracketTitleRow homeTitleRow bracketTitleNameRow';
          titleRow.appendChild(titleInput);
          randomRow.insertAdjacentElement('afterend', titleRow);
        }
      }
    }
  } catch (e) {
    console.warn('Mobile title/button layout tweak failed:', e);
  }

  // Phase 3 cue: initialize (informational only)
  __phase3.hasSaved = !!state.bracketId;
  phase3UpdateVisibility();
  window.addEventListener('resize', ()=>{ phase3UpdateVisibility(); });

  // Home page challenge buttons
  qs('#homeGoBest')?.addEventListener('click', (e)=>{ e.preventDefault(); window.location.href='best-challenge.html'; });
  qs('#homeGoWorst')?.addEventListener('click', (e)=>{ e.preventDefault(); window.location.href='worst-challenge.html'; });

  // Admin view controls
  qs('#adminBracketsMore')?.addEventListener('click', ()=>loadAdminBracketsView(false));
  qs('#adminFeaturedFilter')?.addEventListener('change', ()=>loadAdminFeaturedReview());


  // Header buttons
  qs('#accountBtn')?.addEventListener('click', async ()=>{
    if(state.me){
      const ok = await confirmModal(`Signed in as ${state.me.email}.`, 'Sign out', 'Cancel');
      if(ok){
        await signOut();
        toast('Signed out.');
      }
      return;
    }
    openAuth();
  });

  // Quick Sign-up button in header
  qs('#signupQuickBtn')?.addEventListener('click', ()=>{
    openAuth();
    // Switch the modal into sign-up mode (email-only auth).
    try{ setAuthMode('signup'); }catch{}
  });

  qs('#bracketsBtn')?.addEventListener('click', ()=>{ window.location.href = 'my-brackets.html'; });
  qs('#createBtn')?.addEventListener('click', ()=>{ window.location.href = 'my-brackets.html?create=1'; });
  qs('#closeBrackets')?.addEventListener('click', closeBracketsOverlay);

  // Mobile-only: move the "My Brackets" button down next to the Save button
  // (we hide the My Brackets tab on mobile, so this keeps navigation accessible).
  try{
    const bracketsBtn = qs('#bracketsBtn');
    const saveBtn = qs('#saveBtn');
    const rowFull = saveBtn ? saveBtn.closest('.actionRowFull') : null;
    if(bracketsBtn && saveBtn && rowFull && window.matchMedia('(max-width: 720px)').matches){
      rowFull.appendChild(bracketsBtn);
    }
  }catch{}

  qs('#saveBtn')?.addEventListener('click', async ()=>{
    // Guest: local save already; Logged-in: force save to account now.
    saveLocal(state.picks);
    if(state.me){
      try{
        await ensureSavedToAccount();
        // Phase 3 cue: hide after a successful save
        phase3MarkSaved();
        toast('Saved to your account.');
      }catch(e){
        if(e && e.message==='CANCELLED') return;
        toast('Could not save. Please try again.');
      }
    }else{
      __pendingPostAuth = { action: 'save' };
      try{
        openAuth('signup', 'Save your bracket');
      }catch(_){
        openAuth('signup');
      }
      toast('Create a free account to keep it and edit later.');
    }
  });

qs('#saveBtnHeader')?.addEventListener('click', async ()=>{
    // Guest: local save already; Logged-in: force save to account now.
    saveLocal(state.picks);
    if(state.me){
      try{
        await ensureSavedToAccount();
        // Phase 3 cue: hide after a successful save
        phase3MarkSaved();
        toast('Saved to your account.');
      }catch(e){
        if(e && e.message==='CANCELLED') return;
        toast('Could not save. Please try again.');
      }
    }else{
      __pendingPostAuth = { action: 'save' };
      try{
        openAuth('signup', 'Save your bracket');
      }catch(_){
        openAuth('signup');
      }
      toast('Create a free account to keep it and edit later.');
    }
  });

  // Random picks + Save/Enter buttons (home + bracket pages)
  const wireRandomPicks = (sel)=>qs(sel)?.addEventListener('click', ()=>{
    try{
      fillRandomPicks();
      toast('Random picks filled.');
    }catch(e){
      console.warn('fillRandomPicks failed', e);
      toast('Could not auto-fill picks.');
    }
  });
  
  // Tiebreaker (Combined Score) — stored in picks["TIEBREAKER_TOTAL"] as a number.
  const bindTiebreakerInput = ()=>{
    const el = qs('#tiebreakerTotal');
    if(!el) return;
    // Init value from state (if any)
    const v = (state.picks||{})['TIEBREAKER_TOTAL'];
    el.value = (v===undefined || v===null || v==='') ? '' : String(v);

    el.addEventListener('input', ()=>{
      if(!state.picks) state.picks = {};
      const raw = (el.value||'').trim();
      if(!raw){
        delete state.picks['TIEBREAKER_TOTAL'];
        return;
      }
      const n = Number(raw);
      if(!Number.isFinite(n)){
        delete state.picks['TIEBREAKER_TOTAL'];
        return;
      }
      // Store as integer (combined score is an integer)
      state.picks['TIEBREAKER_TOTAL'] = Math.max(0, Math.round(n));
    });
  };

  const updateTiebreakerUI = ()=>{
    const el = qs('#tiebreakerTotal');
    if(!el) return;
    const v = (state.picks||{})['TIEBREAKER_TOTAL'];
    const next = (v===undefined || v===null || v==='') ? '' : String(v);
    if(el.value !== next) el.value = next;
  };

  wireRandomPicks('#randomPicksBtn');
  wireRandomPicks('#randomPicksBtnTop');
  // Mobile topbar button (Home only)
  wireRandomPicks('#randomPicksBtnHeader');
  bindTiebreakerInput();
const wireSaveEnter = (sel)=>qs(sel)?.addEventListener('click', async ()=>{
    // Save/Enter: ensure the bracket exists in the user's account, then go to My Brackets
    saveLocal(state.picks);
    // Require a championship tiebreaker ONLY when the Official Bracket is live.
    if(OFFICIAL_BRACKET_LIVE && state.picks && state.picks.CHAMPION){
      const tb = state.picks.TIEBREAKER_TOTAL;
      if(tb===null || tb===undefined || tb==='' || !Number.isFinite(Number(tb))){
        toast('Please enter Tiebreaker: Total Points in Final.');
        try{
          const el = qs('#tiebreakerTotal');
          if(el){ el.focus(); el.scrollIntoView({behavior:'smooth', block:'center'}); }
        }catch(_e){}
        return;
      }
    }
    if(!state.me){
      // Default to sign-up when a guest tries to Save/Enter
      __pendingPostAuth = { action: 'saveEnter' };
      try{
        openAuth('signup', 'Save your bracket');
      }catch(_){
        openAuth('signup');
      }
      return;
    }
    try{
      // Capture any in-progress title edits even if the user didn't click out yet.
      const liveTitle = getBracketTitleFromDom();
      if(liveTitle) state.bracketTitle = liveTitle;

      // Force-create a new bracket if we are on home page or if ?new=1 on bracket page.
      // BUT: if the user is currently editing an existing bracket (e.g., opened from My Brackets),
      // we should SAVE that bracket instead of forcing a new one. Otherwise Save/Enter can
      // wrongly trigger “You already have a bracket with that name.”
      const sp = new URLSearchParams(location.search);
      const isNewParam = (sp.get('new') === '1');
      const isHomePath = (location.pathname.endsWith('index.html') || location.pathname === '/' || location.pathname === '');
      const urlMeta = getBracketMetaFromUrl();
      const hasExisting = !!(urlMeta.bracketId || state.bracketId);

      const isNewFlow = (isNewParam || (isHomePath && !hasExisting));
      if(isNewFlow){
        // IMPORTANT: determine the correct bracket_type for NEW brackets created from this page.
        // Priority: Sweet 16 mode (Second Chance) > Official live > Bracketology.
        // This ensures home-page Save/Enter routes to the right My Brackets section.
        const isHome = IS_HOME;
        if(isHome){
          if(sweet16ModeEnabled()) state.bracket_type = 'second_chance';
          else if(OFFICIAL_BRACKET_LIVE) state.bracket_type = 'official';
          else state.bracket_type = 'bracketology';
        }
        // Clear any existing bracketId so we create a fresh bracket
        state.bracketId = null;
        state.bracketTitle = null;
        saveMeta({ bracketId:null, bracketTitle: null });
      }
      const id = await ensureSavedToAccount();
      // Phase 3 cue: hide after a successful save
      phase3MarkSaved();
      await maybeAskSubmitFeatured(id);
      window.location.href = `my-brackets.html?newId=${encodeURIComponent(id)}`;
    }catch(e){
      if(e && e.message==='CANCELLED') return;
      if(e && e.message==='NAME_TAKEN'){
        alert('You already have a bracket with that name. Please choose a different name.');
        return;
      }
      console.warn('saveEnter failed', e);
      toast('Could not save. Please try again.');
    }
  });
  wireSaveEnter('#saveEnterBtn');
  wireSaveEnter('#saveEnterBtnTop');
  // Undo buttons (bracket header + mobile topbar)
  qs('#undoBtnTop')?.addEventListener('click', ()=>undoLastAction());
  qs('#undoBtnHeader')?.addEventListener('click', ()=>undoLastAction());
  updateUndoUI();

  qs('#resetBtn')?.addEventListener('click', ()=>{
    if(!confirm('Reset all picks?')) return;
    state.undoStack = [];
    state.picks = {};
    saveLocal({});
    updateUndoUI();
    state.bracketId = null;
    saveMeta({ bracketId:null, bracketTitle: state.bracketTitle });
    state.promptedForAuth = false;
    renderAll();
    toast('Reset.');
  });

  // Auth overlay wiring
  qs('#authClose')?.addEventListener('click', closeAuth);
  qs('#authOverlay')?.addEventListener('click', (e)=>{ if(e.target.id==='authOverlay') closeAuth(); });

  qs('#signInBtn')?.addEventListener('click', ()=>setAuthMode('signin'));
  qs('#signUpBtn')?.addEventListener('click', ()=>setAuthMode('signup'));
  setAuthMode('signin');

  qs('#forgotPwLink')?.addEventListener('click', async (e)=>{
    e.preventDefault();
    const prefill = (qs('#authEmail')?.value || '').trim();
    const email = window.prompt('Enter your email to reset your password:', prefill);
    if(email === null) return;
    await requestPasswordReset(email);
  });

  qs('#authSubmit')?.addEventListener('click', async ()=>{
    const btn = qs('#authSubmit');
    if(btn && btn.dataset && btn.dataset.busy === '1') return;
    if(btn && btn.dataset) btn.dataset.busy = '1';
    if(btn) btn.disabled = true;

    const mode = qs('#authMode').value;
    const email = qs('#authEmail').value.trim().toLowerCase();
    const password = qs('#authPassword').value;
    if(!email || !email.includes('@')){ toast('Enter a valid email.'); if(btn){btn.disabled=false;} if(btn&&btn.dataset){btn.dataset.busy='0';} return; }
    if(!password || password.length < 8){ toast('Password must be at least 8 characters.'); if(btn){btn.disabled=false;} if(btn&&btn.dataset){btn.dataset.busy='0';} return; }

    try{
      if(mode === 'signup'){
        await doSignup(email, password);
      }else{
        await doSignin(email, password);
      }

      // If a guest initiated a save flow, resume it now that we're authenticated.
      if(__pendingPostAuth && state.me){
        const pending = __pendingPostAuth;
        __pendingPostAuth = null;
        closeAuth();
        try{
          const __savedId = await ensureSavedToAccount(false);
          toast('Saved to your account.');
          await maybeAskSubmitFeatured(__savedId);
          if(pending.action === 'saveEnter'){
            showTab('mybrackets');
            await renderMyBrackets();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }catch(e){
          console.error(e);
          toast('Signed in, but we could not save your bracket. Please try Save again.');
        }
        return;
      }

      closeAuth();
      toast('Signed in.');
      // Do NOT force-create/name a bracket on first login/signup.
      // If user was editing an existing saved bracket (bracketId in URL/meta), we can save silently.
      const meta = getBracketMetaFromUrl();
      const existingId = meta.bracketId || state.bracketId;
      if(existingId && Object.keys(state.picks||{}).length){
        try{ await ensureSavedToAccount(); }catch(e){ console.warn(e); }
      }
    }catch(e){
      // Helpful UX for common auth errors
      if(e && e.status === 409){
        toast('Email already registered. Tap Sign in instead.');
        try{ setAuthMode('signin'); }catch(_){}
      }else if(e && e.status === 429){
        toast('Too many attempts. Try again in a few minutes.');
      }else{
        toast(e.message || 'Auth failed.');
      }
    }finally{
      if(btn){ btn.disabled = false; }
      if(btn && btn.dataset){ btn.dataset.busy = '0'; }
    }
  });

  // Share overlay
  qs('#closeShare')?.addEventListener('click', closeShareOverlay);
  qs('#shareOverlay')?.addEventListener('click', (e)=>{ if(e.target.id==='shareOverlay') closeShareOverlay(); });

  qs('#copyShareBtn')?.addEventListener('click', async ()=>{
    try{
      await navigator.clipboard.writeText(shareText());
      toast('Copied.');
    }catch{
      toast('Copy failed.');
    }
  });

  qs('#shareBtn')?.addEventListener('click', async ()=>{
    const text = shareText();
    try{
      if(navigator.share){
        await navigator.share({ text, url: shareUrl() });
      }else{
        await navigator.clipboard.writeText(text);
        toast('Copied.');
      }
    }catch{}
  });

  // Site stats
  try{ await renderStatsBadge(); }catch{}

  // Groups UI
  try{ await initGroupsUI('best'); }catch{}
  try{ await initGroupsUI('worst'); }catch{}
  try{ await renderLeaderboardsForCurrentGroups(); }catch{}

  // Featured submit
  qs('#submitFeaturedBtn')?.addEventListener('click', async ()=>{
    try{ await submitFeatured(); }catch(e){ toast(e.message || 'Submit failed.'); }
  });
});


// Ensure global access (classic script navigation)
try { window.renderChallenges = renderChallenges; } catch(e) {}
try { window.renderChallengeCallout = renderChallengeCallout; } catch(e) {}


/* PATCH 19: Age confirmation modal for sportsbook links */
document.addEventListener("click", function(e) {
  const link = e.target.closest("a[data-sportsbook]");
  if (!link) return;

  e.preventDefault();

  if (confirm("By proceeding, you confirm that you are 21 years of age or older and eligible to use online sportsbook services in your jurisdiction.")) {
    window.location.href = link.href;
  }
});

/* === DYNAMIC_ROUND_HEADER_PATCH === */
(function(){
  const roundBar = document.getElementById('roundBar');
  const scrollers = document.querySelectorAll('.geo');
  if(!roundBar || !scrollers.length) return;

  const labels = ['Round of 64','Round of 32','Sweet 16','Elite 8','Final 4'];

  function updateHeader(scroller){
    const colWidth = scroller.scrollWidth / 5;
    const idx = Math.min(4, Math.max(0, Math.round(scroller.scrollLeft / colWidth)));
    roundBar.textContent = labels[idx];
  }

  scrollers.forEach(s => {
    s.addEventListener('scroll', () => updateHeader(s), { passive:true });
  });
})();


function triggerSaveAndGoMyBrackets(){
  try{
    saveBracket().then(()=>{
      window.location.href = '/my-brackets.html';
    });
  }catch(e){}
}
