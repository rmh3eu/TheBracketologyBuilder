
async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: {'Content-Type': 'application/json', ...(opts.headers || {})},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin'
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const err = new Error((data && data.error) || res.statusText || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function getMe(){
  try { return await api('/api/me'); } catch { return null; }
}
function isAdminFromMe(me){
  return !!((me && me.user && (me.user.isAdmin || me.user.is_admin)) || (me && (me.isAdmin || me.is_admin)));
}
function showAdminNav(isAdmin){
  const a = document.getElementById('adminBracketsNavLink');
  const b = document.getElementById('adminFeaturedNavLink');
  if (a) a.style.display = isAdmin ? '' : 'none';
  if (b) b.style.display = isAdmin ? '' : 'none';
}

let __adminBracketsOffset = 0;
async function loadAdminBracketsView(reset = true){
  const mount = document.getElementById('adminBracketsMount');
  const btnMore = document.getElementById('adminBracketsMore');
  const status = document.getElementById('adminBracketsStatus');
  if(!mount) return;

  const limit = 100;
  if(reset){ __adminBracketsOffset = 0; mount.innerHTML = ''; }
  if(status) status.textContent = 'Loading…';
  if(btnMore) btnMore.disabled = true;

  try{
    const d = await api(`/api/admin/brackets?limit=${limit}&offset=${__adminBracketsOffset}`, { method:'GET' });
    const rows = Array.isArray(d?.brackets) ? d.brackets : [];
    if(reset){
      mount.innerHTML = `<table class="adminTable"><thead><tr><th>Bracket</th><th>User</th><th>Type</th><th>Updated</th><th></th></tr></thead><tbody id="adminBracketsBody"></tbody></table>`;
    }
    const body = document.getElementById('adminBracketsBody');
    if(!body) return;

    rows.forEach(r=>{
      const tr = document.createElement('tr');
      const href = `/bracket.html?id=${encodeURIComponent(r.id)}&readonly=1`;
      tr.innerHTML = `<td>${String(r.title || 'Untitled Bracket')}</td><td class="muted">${String(r.user_email || ('User #' + (r.user_id || '')))}</td><td>${String(r.bracket_type || 'bracketology')}</td><td class="muted">${r.updated_at ? new Date(r.updated_at).toLocaleString() : ''}</td><td><a class="btn ghost smallBtn" href="${href}" target="_blank" rel="noopener">Open</a> <button class="btn ghost smallBtn" type="button" data-edit-id="${String(r.id || '')}">Edit Picks</button></td>`;
      body.appendChild(tr);
    });
    body.querySelectorAll('[data-edit-id]').forEach(btn=>{
      btn.addEventListener('click', ()=>loadBracketIntoEditor(btn.getAttribute('data-edit-id')));
    });

    __adminBracketsOffset += rows.length;
    if(status) status.textContent = rows.length ? '' : (reset ? 'No brackets found.' : 'No more results.');
    if(btnMore) btnMore.disabled = rows.length < limit;
  }catch(e){
    if(status) status.textContent = 'Could not load brackets.';
    if(btnMore) btnMore.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', async ()=>{
  const me = await getMe();
  const isAdmin = isAdminFromMe(me);
  showAdminNav(isAdmin);
  const gate = document.getElementById('adminGatePanel');
  const msg = document.getElementById('adminGateMsg');
  const panel = document.getElementById('adminAllBracketsPanel');
  const more = document.getElementById('adminBracketsMore');
  if(!isAdmin){
    if(msg) msg.textContent = 'Admin access only.';
    return;
  }
  if(gate) gate.style.display = 'none';
  if(panel) panel.style.display = '';
  const loadBtn = document.getElementById('adminBracketLoadBtn');
  const saveBtn = document.getElementById('adminBracketSaveBtn');
  const input = document.getElementById('adminBracketIdInput');
  if(loadBtn) loadBtn.addEventListener('click', ()=>loadBracketIntoEditor((input?.value || '').trim()));
  if(saveBtn) saveBtn.addEventListener('click', saveBracketEditor);
  if(input) input.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') loadBracketIntoEditor((input?.value || '').trim()); });
  if(more) more.addEventListener('click', ()=>loadAdminBracketsView(false));
  await loadAdminBracketsView(true);
  const prefill = new URLSearchParams(window.location.search).get('edit');
  if(prefill){
    const input = document.getElementById('adminBracketIdInput');
    if(input) input.value = prefill;
    await loadBracketIntoEditor(prefill);
  }
});


async function loadBracketIntoEditor(bracketId){
  const status = document.getElementById('adminBracketEditorStatus');
  const meta = document.getElementById('adminBracketEditorMeta');
  const ta = document.getElementById('adminBracketPicksTextarea');
  const panel = document.getElementById('adminBracketEditorPanel');
  if(!bracketId){ if(status) status.textContent = 'Enter a bracket ID first.'; return; }
  if(panel) panel.style.display = '';
  if(status) status.textContent = 'Loading bracket…';
  try{
    const d = await api(`/api/admin/brackets?id=${encodeURIComponent(bracketId)}`, { method:'GET' });
    const b = d?.bracket;
    const picks = b?.picks || {};
    if(ta) ta.value = JSON.stringify(picks, null, 2);
    if(meta) meta.textContent = `${b?.title || 'Untitled'} • ${b?.user_email || ''} • ${b?.bracket_type || 'bracketology'}`;
    const input = document.getElementById('adminBracketIdInput');
    if(input) input.value = b?.id || bracketId;
    if(status) status.textContent = 'Loaded.';
  }catch(e){ if(status) status.textContent = e.message || 'Could not load bracket.'; }
}

async function saveBracketEditor(){
  const input = document.getElementById('adminBracketIdInput');
  const ta = document.getElementById('adminBracketPicksTextarea');
  const status = document.getElementById('adminBracketEditorStatus');
  const bracketId = (input?.value || '').trim();
  if(!bracketId){ if(status) status.textContent = 'Enter a bracket ID first.'; return; }
  let picks;
  try{ picks = JSON.parse(ta?.value || '{}'); }catch(e){ if(status) status.textContent = 'Picks JSON is invalid.'; return; }
  if(status) status.textContent = 'Saving…';
  try{ await api('/api/admin/brackets', { method:'POST', body:{ id: bracketId, picks } }); if(status) status.textContent = 'Picks saved.'; }catch(e){ if(status) status.textContent = e.message || 'Could not save picks.'; }
}
