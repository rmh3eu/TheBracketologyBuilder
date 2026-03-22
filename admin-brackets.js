
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
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const err = new Error((data && data.error) || res.statusText || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

let __adminBracketsOffset = 0;

async function loadAdminBracketsView(reset = true){
  const panel = document.getElementById('adminAllBracketsPanel');
  const mount = document.getElementById('adminBracketsMount');
  const btnMore = document.getElementById('adminBracketsMore');
  const status = document.getElementById('adminBracketsStatus');
  if(!panel || !mount) return;

  const limit = 100;
  if(reset){
    __adminBracketsOffset = 0;
    mount.innerHTML = '';
  }
  if(status) status.textContent = 'Loading…';
  if(btnMore) btnMore.disabled = true;

  try{
    const d = await api(`/api/admin/brackets?limit=${limit}&offset=${__adminBracketsOffset}`, { method:'GET' });
    const rows = Array.isArray(d?.brackets) ? d.brackets : [];

    if(reset){
      mount.innerHTML = `
        <table class="adminTable">
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
        </table>
      `;
    }

    const body = document.getElementById('adminBracketsBody');
    if(!body) return;

    rows.forEach(r=>{
      const tr = document.createElement('tr');
      const title = String(r.title || 'Untitled Bracket');
      const email = String(r.user_email || ('User #' + (r.user_id || '')));
      const typ = String(r.bracket_type || 'bracketology');
      const upd = r.updated_at ? new Date(r.updated_at).toLocaleString() : '';
      const href = `/?id=${encodeURIComponent(r.id)}&readonly=1`;
      tr.innerHTML = `
        <td>${title}</td>
        <td class="muted">${email}</td>
        <td>${typ}</td>
        <td class="muted">${upd}</td>
        <td><a class="btn ghost smallBtn" href="${href}" target="_blank" rel="noopener">Open</a></td>
      `;
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

function renderAdminFeatureCard(req, bucket){
  const wrap = document.createElement('div');
  wrap.className = 'featureReviewCard';
  const when = req.created_at ? new Date(req.created_at).toLocaleString() : '';
  const href = `/?id=${encodeURIComponent(req.bracket_id)}&readonly=1`;
  const actions = bucket === 'pending'
    ? `<div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
         <button class="btn primary" data-fr-id="${req.id}" data-fr-status="approved" type="button">Approve</button>
         <button class="btn" data-fr-id="${req.id}" data-fr-status="rejected" type="button">Reject</button>
       </div>`
    : '';
  wrap.innerHTML = `
    <div><b>${String(req.title || 'Untitled Bracket')}</b></div>
    <div class="muted" style="margin-top:4px;">${String(req.user_email || '')}</div>
    <div class="muted" style="margin-top:4px;">${when}</div>
    ${req.caption ? `<div style="margin-top:8px;">${String(req.caption)}</div>` : ''}
    <div style="margin-top:10px;"><a class="btn ghost smallBtn" href="${href}" target="_blank" rel="noopener">Open Bracket</a></div>
    ${actions}
  `;
  if(bucket === 'pending'){
    wrap.querySelectorAll('[data-fr-id]').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const id = btn.getAttribute('data-fr-id');
        const status = btn.getAttribute('data-fr-status');
        try{
          await api('/api/feature', { method:'PUT', body:{ id, status } });
          await loadAdminFeaturedReview();
        }catch(e){
          alert((e && e.message) ? e.message : 'Could not update request.');
        }
      });
    });
  }
  return wrap;
}

async function loadAdminFeaturedReview(){
  const statusNode = document.getElementById('adminFeaturedStatus');
  const mounts = {
    pending: document.getElementById('adminFeaturedPending'),
    approved: document.getElementById('adminFeaturedApproved'),
    rejected: document.getElementById('adminFeaturedDenied')
  };
  if(!statusNode || !mounts.pending || !mounts.approved || !mounts.rejected) return;

  Object.values(mounts).forEach(n => n.innerHTML = '');
  statusNode.textContent = 'Loading…';

  try{
    for(const bucket of ['pending','approved','rejected']){
      const d = await api(`/api/feature?status=${encodeURIComponent(bucket)}`, { method:'GET' });
      const rows = Array.isArray(d?.requests) ? d.requests : [];
      if(!rows.length){
        mounts[bucket].innerHTML = '<div class="muted">None.</div>';
      }else{
        rows.forEach(req => mounts[bucket].appendChild(renderAdminFeatureCard(req, bucket)));
      }
    }
    statusNode.textContent = '';
  }catch(e){
    statusNode.textContent = 'Could not load featured review.';
  }
}

async function initAdminPage(){
  const gateMsg = document.getElementById('adminGateMsg');
  const gatePanel = document.getElementById('adminGatePanel');
  const adminAllBracketsPanel = document.getElementById('adminAllBracketsPanel');
  const adminFeaturedPanel = document.getElementById('adminFeaturedPanel');
  const adminNavLink = document.getElementById('adminNavLink');
  const adminMoreBtn = document.getElementById('adminBracketsMore');

  let me = null;
  try {
    me = await api('/api/me');
  } catch {}

  const isAdmin = !!(
    (me && me.user && (me.user.isAdmin || me.user.is_admin)) ||
    (me && (me.isAdmin || me.is_admin))
  );

  if(isAdmin && adminNavLink) adminNavLink.style.display = '';

  if(!isAdmin){
    if(gateMsg) gateMsg.textContent = 'Admin access only.';
    return;
  }

  if(gatePanel) gatePanel.style.display = 'none';
  if(adminAllBracketsPanel) adminAllBracketsPanel.style.display = '';
  if(adminFeaturedPanel) adminFeaturedPanel.style.display = '';
  if(adminMoreBtn && !adminMoreBtn._wired){
    adminMoreBtn._wired = true;
    adminMoreBtn.addEventListener('click', ()=>loadAdminBracketsView(false));
  }

  await loadAdminBracketsView(true);
  await loadAdminFeaturedReview();
}

document.addEventListener('DOMContentLoaded', initAdminPage);
