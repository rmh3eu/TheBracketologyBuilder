(function(){
  function qs(sel){ return document.querySelector(sel); }
  function setMsg(t){ const m = qs('#msg'); if(m) m.textContent = t || ''; }

  async function api(path, opts){
    const res = await fetch(path, Object.assign({ headers: { 'content-type':'application/json' } }, opts||{}));
    let data = null;
    try{ data = await res.json(); }catch(e){ data = null; }
    if(!res.ok){
      const msg = (data && (data.message || data.error)) || 'Request failed.';
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function getToken(){
    try{
      const u = new URL(window.location.href);
      return u.searchParams.get('token') || '';
    }catch(e){
      return '';
    }
  }

  async function onReset(){
    const token = getToken();
    const pw = (qs('#newPw')?.value || '');
    const pw2 = (qs('#newPw2')?.value || '');

    if(!token){ setMsg('Missing reset token. Please request a new reset link.'); return; }
    if(pw.length < 8){ setMsg('Password must be at least 8 characters.'); return; }
    if(pw !== pw2){ setMsg('Passwords do not match.'); return; }

    const btn = qs('#resetBtn');
    if(btn){ btn.disabled = true; }
    setMsg('Working…');

    try{
      await api('/api/reset-password', { method:'POST', body: JSON.stringify({ token, password: pw })});
      setMsg('Password updated. Redirecting you to sign in…');
      setTimeout(()=>{ window.location.href = '/#signin'; }, 900);
    }catch(e){
      setMsg(e.message || 'Could not reset password.');
    }finally{
      if(btn){ btn.disabled = false; }
    }
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    qs('#resetBtn')?.addEventListener('click', onReset);
  });
})();
