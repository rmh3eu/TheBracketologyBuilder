
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
  wrap.innerHTML = `<div><b>${String(req.title || 'Untitled Bracket')}</b></div><div class="muted" style="margin-top:4px;">${String(req.user_email || '')}</div><div class="muted" style="margin-top:4px;">${when}</div>${req.caption ? `<div style="margin-top:8px;">${String(req.caption)}</div>` : ''}<div style="margin-top:10px;"><a class="btn ghost smallBtn" href="${href}" target="_blank" rel="noopener">Open Bracket</a></div>${actions}`;
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

document.addEventListener('DOMContentLoaded', async ()=>{
  const me = await getMe();
  const isAdmin = isAdminFromMe(me);
  showAdminNav(isAdmin);
  const gate = document.getElementById('adminGatePanel');
  const msg = document.getElementById('adminGateMsg');
  const panel = document.getElementById('adminFeaturedPanel');
  if(!isAdmin){
    if(msg) msg.textContent = 'Admin access only.';
    return;
  }
  if(gate) gate.style.display = 'none';
  if(panel) panel.style.display = '';
  await loadAdminFeaturedReview();
});
