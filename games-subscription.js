async function gsApi(path, opts = {}){
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: Object.assign({ 'Content-Type':'application/json' }, opts.headers || {}),
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin'
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw:text }; }
  if(!res.ok){
    const err = new Error((data && (data.message || data.error || data.detail)) || res.statusText || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const els = {
  signedOut: document.getElementById('gsSignedOut'),
  signedIn: document.getElementById('gsSignedIn'),
  signedInEmail: document.getElementById('gsSignedInEmail'),
  authMsg: document.getElementById('gsAuthMsg'),
  loginEmail: document.getElementById('gsLoginEmail'),
  loginPassword: document.getElementById('gsLoginPassword'),
  registerEmail: document.getElementById('gsRegisterEmail'),
  registerPassword: document.getElementById('gsRegisterPassword'),
  loginBtn: document.getElementById('gsLoginBtn'),
  registerBtn: document.getElementById('gsRegisterBtn'),
  checkoutBtn: document.getElementById('gsCheckoutBtn')
};

function setSignedIn(user){
  const yes = !!user;
  els.signedOut.classList.toggle('gs-hidden', yes);
  els.signedIn.classList.toggle('gs-hidden', !yes);
  els.signedInEmail.textContent = yes ? `Signed in as ${user.email}` : '';
}

async function refreshMe(){
  try{
    const data = await gsApi('/api/me');
    setSignedIn(data && data.user ? data.user : null);
    return data && data.user ? data.user : null;
  }catch(_e){
    setSignedIn(null);
    return null;
  }
}

async function beginCheckout(){
  els.authMsg.textContent = '';
  const btn = els.checkoutBtn;
  if(btn){ btn.disabled = true; btn.textContent = 'Opening Stripe…'; }
  try{
    const data = await gsApi('/api/create-checkout-session', { method:'POST' });
    if(!data || !data.url) throw new Error('Stripe checkout is not ready yet.');
    window.location.href = data.url;
  }catch(err){
    els.authMsg.textContent = String(err.message || err);
    if(btn){ btn.disabled = false; btn.textContent = 'Subscribe with Stripe'; }
  }
}

async function loginAndContinue(){
  els.authMsg.textContent = '';
  const email = String(els.loginEmail.value || '').trim();
  const password = String(els.loginPassword.value || '');
  if(!email || !password){ els.authMsg.textContent = 'Enter your email and password.'; return; }
  els.loginBtn.disabled = true;
  try{
    await gsApi('/api/login', { method:'POST', body:{ email, password } });
    await refreshMe();
    await beginCheckout();
  }catch(err){
    els.authMsg.textContent = String(err.message || err);
  }finally{
    els.loginBtn.disabled = false;
  }
}

async function registerAndContinue(){
  els.authMsg.textContent = '';
  const email = String(els.registerEmail.value || '').trim();
  const password = String(els.registerPassword.value || '');
  if(!email || !password){ els.authMsg.textContent = 'Enter an email and password.'; return; }
  els.registerBtn.disabled = true;
  try{
    await gsApi('/api/register', { method:'POST', body:{ email, password } });
    await gsApi('/api/login', { method:'POST', body:{ email, password } });
    await refreshMe();
    await beginCheckout();
  }catch(err){
    els.authMsg.textContent = String(err.message || err);
  }finally{
    els.registerBtn.disabled = false;
  }
}

els.loginBtn?.addEventListener('click', loginAndContinue);
els.registerBtn?.addEventListener('click', registerAndContinue);
els.checkoutBtn?.addEventListener('click', beginCheckout);
refreshMe();
