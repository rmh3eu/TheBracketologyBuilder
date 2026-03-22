
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
      const href = `/?id=${encodeURIComponent(r.id)}&readonly=1`;
      tr.innerHTML = `<td>${String(r.title || 'Untitled Bracket')}</td><td class="muted">${String(r.user_email || ('User #' + (r.user_id || '')))}</td><td>${String(r.bracket_type || 'bracketology')}</td><td class="muted">${r.updated_at ? new Date(r.updated_at).toLocaleString() : ''}</td><td><a class="btn ghost smallBtn" href="${href}" target="_blank" rel="noopener">Open</a></td>`;
      body.appendChild(tr);
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
  if(more) more.addEventListener('click', ()=>loadAdminBracketsView(false));
  await loadAdminBracketsView(true);
});
