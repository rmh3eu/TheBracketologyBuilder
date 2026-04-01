
const BETR_LINK='https://engagebetr.onelink.me/auSX/BRACKETS';
const BETONLINE_LINK='https://record.betonlineaffiliates.ag/_xZrmHTbHGhIoAmwrkE6KlGNd7ZgqdRLk/1/';
const VENMO_LINK='https://venmo.com/code?user_id=4201433712821958268&created=1775055394.782236&printed=1';
const NBA = {
  east: { seeds: [{seed:1,name:'Detroit Pistons'},{seed:3,name:'New York Knicks'},{seed:2,name:'Boston Celtics'},{seed:4,name:'Cleveland Cavaliers'},{seed:5,name:'Toronto Raptors'},{seed:6,name:'Atlanta Hawks'},{seed:7,name:'Philadelphia 76ers'},{seed:8,name:'Orlando Magic'},{seed:9,name:'Charlotte Hornets'},{seed:10,name:'Miami Heat'}] },
  west: { seeds: [{seed:1,name:'Oklahoma City Thunder'},{seed:3,name:'Los Angeles Lakers'},{seed:2,name:'San Antonio Spurs'},{seed:4,name:'Denver Nuggets'},{seed:5,name:'Minnesota Timberwolves'},{seed:6,name:'Houston Rockets'},{seed:7,name:'Phoenix Suns'},{seed:8,name:'LA Clippers'},{seed:9,name:'Portland Trail Blazers'},{seed:10,name:'Golden State Warriors'}] }
};
const state = {
  bracketId:null,
  east:{ play7:null, play8:null, r1:{}, r2:{}, conf:null },
  west:{ play7:null, play8:null, r1:{}, r2:{}, conf:null },
  finals:null,
  me:null,
  savingAfterAuth:false
};
function params(){return new URLSearchParams(window.location.search);}
async function api(path, opts={}){
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: Object.assign({'Content-Type':'application/json'}, opts.headers || {}),
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin'
  });
  const text = await res.text();
  let data = null;
  try{ data = text ? JSON.parse(text) : null; }catch(e){ data = text; }
  if(!res.ok){
    const err = new Error((data && (data.message || data.error)) || res.statusText || 'Request failed');
    err.status = res.status; err.data = data; throw err;
  }
  return data;
}
function getBySeed(conf, seed){ return NBA[conf].seeds.find(x => x.seed === seed) || null; }
function cloneTeam(t){ return t ? {seed:t.seed,name:t.name} : null; }
function sameTeam(a,b){ return !!a && !!b && a.seed===b.seed && a.name===b.name; }
function winnerOf(o){ return o && o.team ? o.team : null; }
function teamLabel(t){ return t ? `${t.seed}. ${t.name}` : '—'; }
function showPopup(title, text, buttons){
  const modal=document.getElementById('nbaPopup');
  document.getElementById('nbaPopupTitle').textContent=title||'Notice';
  document.getElementById('nbaPopupText').textContent=text||'';
  const actions=document.getElementById('nbaPopupActions'); actions.innerHTML='';
  (buttons||[{label:'Close',onClick:hidePopup,kind:'btn'}]).forEach(btn=>{
    const b=document.createElement('button');
    b.type='button'; b.className=btn.className || btn.kind || 'btn'; b.textContent=btn.label || 'Close';
    b.addEventListener('click', ()=>{ if(btn.href){ window.open(btn.href, btn.target || '_blank'); } if(btn.onClick) btn.onClick(); if(!btn.keepOpen) hidePopup(); });
    actions.appendChild(b);
  });
  modal.classList.add('show');
}
function hidePopup(){ document.getElementById('nbaPopup').classList.remove('show'); }
function showAuthModal(){ document.getElementById('nbaAuthModal').classList.add('show'); }
function hideAuthModal(){ document.getElementById('nbaAuthModal').classList.remove('show'); }
async function refreshMe(){ try{ const d=await api('/api/me'); state.me=d && d.user ? d.user : null; }catch(_e){ state.me=null; } }

function getConferenceField(conf){
  const play7 = state[conf].play7 || getBySeed(conf,7);
  const play8 = state[conf].play8 || getBySeed(conf,8);
  return {
    r1: [
      [getBySeed(conf,1), play8 || getBySeed(conf,8)],
      [getBySeed(conf,4), getBySeed(conf,5)],
      [getBySeed(conf,3), getBySeed(conf,6)],
      [getBySeed(conf,2), play7 || getBySeed(conf,7)]
    ],
    r2: [
      [winnerOf(state[conf].r1.a), winnerOf(state[conf].r1.b)],
      [winnerOf(state[conf].r1.c), winnerOf(state[conf].r1.d)]
    ],
    cf: [[winnerOf(state[conf].r2.a), winnerOf(state[conf].r2.b)]]
  };
}
function seriesSelect(current, onChange){
  const sel=document.createElement('select'); sel.className='nbaSeriesSelect';
  const blank=document.createElement('option'); blank.value=''; blank.textContent='Games'; sel.appendChild(blank);
  ['4','5','6','7'].forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=v; if(String(current||'')===v) o.selected=true; sel.appendChild(o); });
  sel.addEventListener('change',()=>onChange(sel.value ? Number(sel.value) : null)); return sel;
}
function teamButton(team, currentWinner, onPick){
  const btn=document.createElement('button'); btn.type='button'; btn.className='nbaTeamBtn'+(sameTeam(team,currentWinner)?' isWinner':''); btn.textContent=teamLabel(team);
  if(!team){ btn.disabled=true; btn.style.opacity='0.45'; } else btn.addEventListener('click',()=>onPick(team)); return btn;
}
function matchupCard(teamA, teamB, seriesObj, onSeriesChange){
  const card=document.createElement('div'); card.className='nbaMatchupCard';
  const currentWinner=winnerOf(seriesObj), currentGames=seriesObj && seriesObj.games;
  card.appendChild(seriesSelect(currentGames, games=>{ const next=seriesObj && typeof seriesObj==='object' ? {...seriesObj, games} : {team:null, games}; onSeriesChange(next); }));
  card.appendChild(teamButton(teamA, currentWinner, team=>{ const next=seriesObj && typeof seriesObj==='object' ? {...seriesObj} : {}; next.team=cloneTeam(team); onSeriesChange(next); }));
  card.appendChild(teamButton(teamB, currentWinner, team=>{ const next=seriesObj && typeof seriesObj==='object' ? {...seriesObj} : {}; next.team=cloneTeam(team); onSeriesChange(next); }));
  return card;
}
function playInCard(teamA, teamB, currentWinner, onPick){
  const card=document.createElement('div'); card.className='nbaMatchupCard';
  const label=document.createElement('div'); label.className='nbaRoundTitle'; label.textContent='Advance Winner'; card.appendChild(label);
  card.appendChild(teamButton(teamA, currentWinner, team=>onPick(cloneTeam(team))));
  card.appendChild(teamButton(teamB, currentWinner, team=>onPick(cloneTeam(team))));
  return card;
}
function renderPlayInTop(){
  const wrap=document.getElementById('nbaPlayInTop'); wrap.innerHTML='';
  const board=document.createElement('div'); board.className='nbaPlayInBoards';
  const eastBox=document.createElement('section'); eastBox.className='nbaPlayInSection'; eastBox.innerHTML='<h3>Eastern Conference Play-In</h3>';
  eastBox.appendChild(playInCard(getBySeed('east',7),getBySeed('east',8),state.east.play7,w=>{state.east.play7=w; state.east.r1.d=null; state.east.r2.b=null; state.east.conf=null; state.finals=null; renderNBA();}));
  eastBox.appendChild(playInCard(getBySeed('east',9),getBySeed('east',10),state.east.play8,w=>{state.east.play8=w; state.east.r1.a=null; state.east.r2.a=null; state.east.conf=null; state.finals=null; renderNBA();}));
  const westBox=document.createElement('section'); westBox.className='nbaPlayInSection'; westBox.innerHTML='<h3>Western Conference Play-In</h3>';
  westBox.appendChild(playInCard(getBySeed('west',7),getBySeed('west',8),state.west.play7,w=>{state.west.play7=w; state.west.r1.d=null; state.west.r2.b=null; state.west.conf=null; state.finals=null; renderNBA();}));
  westBox.appendChild(playInCard(getBySeed('west',9),getBySeed('west',10),state.west.play8,w=>{state.west.play8=w; state.west.r1.a=null; state.west.r2.a=null; state.west.conf=null; state.finals=null; renderNBA();}));
  board.appendChild(eastBox); board.appendChild(westBox); wrap.appendChild(board);
}
function renderConference(conf, title, mirror){
  const field=getConferenceField(conf);
  const board=document.createElement('section'); board.className='nbaConferenceBoard'; board.innerHTML=`<h3>${title}</h3>`;
  const r1=document.createElement('div'); r1.className='nbaRoundColumn'; r1.innerHTML='<div class="nbaRoundTitle">Round 1</div>';
  r1.appendChild(matchupCard(field.r1[0][0],field.r1[0][1],state[conf].r1.a,next=>{state[conf].r1.a=next; state[conf].r2.a=null; state[conf].conf=null; state.finals=null; renderNBA();}));
  r1.appendChild(matchupCard(field.r1[1][0],field.r1[1][1],state[conf].r1.b,next=>{state[conf].r1.b=next; state[conf].r2.a=null; state[conf].conf=null; state.finals=null; renderNBA();}));
  r1.appendChild(matchupCard(field.r1[2][0],field.r1[2][1],state[conf].r1.c,next=>{state[conf].r1.c=next; state[conf].r2.b=null; state[conf].conf=null; state.finals=null; renderNBA();}));
  r1.appendChild(matchupCard(field.r1[3][0],field.r1[3][1],state[conf].r1.d,next=>{state[conf].r1.d=next; state[conf].r2.b=null; state[conf].conf=null; state.finals=null; renderNBA();}));
  const r2=document.createElement('div'); r2.className='nbaRoundColumn'; r2.innerHTML='<div class="nbaRoundTitle">Conference Semis</div>';
  r2.appendChild(matchupCard(field.r2[0][0],field.r2[0][1],state[conf].r2.a,next=>{state[conf].r2.a=next; state[conf].conf=null; state.finals=null; renderNBA();}));
  r2.appendChild(matchupCard(field.r2[1][0],field.r2[1][1],state[conf].r2.b,next=>{state[conf].r2.b=next; state[conf].conf=null; state.finals=null; renderNBA();}));
  const cf=document.createElement('div'); cf.className='nbaRoundColumn'; cf.innerHTML='<div class="nbaRoundTitle">Conference Finals</div>';
  cf.appendChild(matchupCard(field.cf[0][0],field.cf[0][1],state[conf].conf,next=>{state[conf].conf=next; state.finals=null; renderNBA();}));
  const grid=document.createElement('div'); grid.className='nbaConferenceGrid'+(mirror?' isMirror':'');
  if(mirror){grid.appendChild(cf); grid.appendChild(r2); grid.appendChild(r1);} else {grid.appendChild(r1); grid.appendChild(r2); grid.appendChild(cf);} board.appendChild(grid); return board;
}
function renderFinals(){
  const box=document.createElement('section'); box.className='nbaFinalsBoard'; box.innerHTML='<h3>NBA Finals</h3>';
  box.appendChild(matchupCard(winnerOf(state.east.conf),winnerOf(state.west.conf),state.finals,next=>{state.finals=next; renderNBA();}));
  const champ=document.createElement('div'); champ.className='nbaChampionDisplay';
  champ.textContent = state.finals && state.finals.team ? `Champion: ${state.finals.team.name}${state.finals.games ? ' in ' + state.finals.games : ''}` : 'Champion';
  box.appendChild(champ);
  const hint=document.createElement('div'); hint.className='nbaFinalHint'; hint.textContent='You can advance teams before choosing 4, 5, 6, or 7. Series-length picks are required when you save.'; box.appendChild(hint);
  return box;
}
function renderNBA(){
  renderPlayInTop();
  const app=document.getElementById('nbaBracketApp'); app.innerHTML='';
  const layout=document.createElement('div'); layout.className='nbaBoardWrap';
  layout.appendChild(renderConference('east','Eastern Conference',false));
  layout.appendChild(renderFinals());
  layout.appendChild(renderConference('west','Western Conference',true));
  app.appendChild(layout);
}
function serializeState(){ return {sport:'nba', template_id:'nba_projection_playin', layout_type:'nba_playoff', picks:{east:state.east, west:state.west, finals:state.finals}}; }
function applyLoaded(data){ const src=data && data.picks ? data.picks : data; if(!src) return; state.east=src.east||state.east; state.west=src.west||state.west; state.finals=src.finals||state.finals; }
async function loadExisting(){ const id=params().get('id'); if(!id) return; try{ const d=await api('/api/bracket?id='+encodeURIComponent(id)); const b=d && d.bracket ? d.bracket : null; if(!b) return; state.bracketId=b.id; document.getElementById('nbaBracketTitle').value=b.title || ''; applyLoaded(b.data || {}); }catch(_e){} }
function missingSeriesLabels(){
  const miss=[];
  const checks=[
    ['East Round 1','a',state.east.r1.a],['East Round 1','b',state.east.r1.b],['East Round 1','c',state.east.r1.c],['East Round 1','d',state.east.r1.d],
    ['East Conference Semis','a',state.east.r2.a],['East Conference Semis','b',state.east.r2.b],['East Conference Finals','a',state.east.conf],
    ['West Round 1','a',state.west.r1.a],['West Round 1','b',state.west.r1.b],['West Round 1','c',state.west.r1.c],['West Round 1','d',state.west.r1.d],
    ['West Conference Semis','a',state.west.r2.a],['West Conference Semis','b',state.west.r2.b],['West Conference Finals','a',state.west.conf],
    ['NBA Finals','a',state.finals]
  ];
  for(const [label,_key,obj] of checks){ if(obj && obj.team && !obj.games) miss.push(label); }
  return miss;
}
async function ensureAuthenticatedAndMaybeSave(){
  await refreshMe();
  if(state.me){ return true; }
  state.savingAfterAuth=true; showAuthModal(); return false;
}
async function saveNBA(){
  const msg=document.getElementById('nbaSaveMsg');
  const rawTitle=(document.getElementById('nbaBracketTitle').value || '').trim();
  if(!rawTitle){ showPopup('Name Required','Name Your Bracket Before Saving',[{label:'Close',onClick:hidePopup,className:'btn primary'}]); return; }
  const missing=missingSeriesLabels();
  if(missing.length){ showPopup('Finish Your Series Picks','Make Sure you Have Selected the Number of Games for Each Series',[{label:'Close',onClick:hidePopup,className:'btn primary'}]); return; }
  if(!(await ensureAuthenticatedAndMaybeSave())) return;
  msg.textContent='Saving...';
  try{
    if(!state.bracketId){
      const created=await api('/api/brackets',{method:'POST',body:{title:rawTitle, bracket_type:'nba', sport:'nba', template_id:'nba_projection_playin', layout_type:'nba_playoff', data:serializeState()}});
      state.bracketId=created.id;
      const u=new URL(window.location.href); u.searchParams.set('id', state.bracketId); history.replaceState(null,'',u.toString());
    }
    await api('/api/bracket?id='+encodeURIComponent(state.bracketId),{method:'PUT',body:{id:state.bracketId,title:rawTitle, bracket_type:'nba', sport:'nba', template_id:'nba_projection_playin', layout_type:'nba_playoff', data:serializeState()}});
    msg.textContent='Saved.';
    window.location.href='my-brackets.html?section=nba';
  }catch(e){
    if(e && e.data && (e.data.error==='NBA_SUBSCRIPTION_REQUIRED' || e.data.error==='GAMES_SUBSCRIPTION_REQUIRED')){
      showPopup('Unlock More NBA Brackets','Two NBA bracket saves are included. Unlock more NBA bracket saves for $5.99/month.',[
        {label:'Subscribe',href:VENMO_LINK,className:'btn primary',keepOpen:true},
        {label:'Close',onClick:hidePopup,className:'btn'}
      ]);
      msg.textContent='';
      return;
    }
    msg.textContent=(e && e.message) ? e.message : 'Could not save.';
  }
}
async function handleLogin(){
  const msg=document.getElementById('nbaAuthMsg'); msg.textContent='';
  try{
    await api('/api/login',{method:'POST',body:{email:document.getElementById('nbaLoginEmail').value.trim(),password:document.getElementById('nbaLoginPassword').value}});
    await refreshMe(); hideAuthModal();
    if(state.savingAfterAuth){ state.savingAfterAuth=false; saveNBA(); }
  }catch(e){ msg.textContent=(e && e.message) ? e.message : 'Could not sign in.'; }
}
async function handleRegister(){
  const msg=document.getElementById('nbaAuthMsg'); msg.textContent='';
  const email=document.getElementById('nbaRegisterEmail').value.trim();
  const password=document.getElementById('nbaRegisterPassword').value;
  try{
    await api('/api/register',{method:'POST',body:{email,password}});
    await api('/api/login',{method:'POST',body:{email,password}});
    await refreshMe(); hideAuthModal();
    if(state.savingAfterAuth){ state.savingAfterAuth=false; saveNBA(); }
  }catch(e){ msg.textContent=(e && e.message) ? e.message : 'Could not sign up.'; }
}
document.getElementById('nbaSaveBtn').addEventListener('click', saveNBA);
document.getElementById('nbaLoginBtn').addEventListener('click', handleLogin);
document.getElementById('nbaRegisterBtn').addEventListener('click', handleRegister);
document.getElementById('nbaPopup').addEventListener('click',(e)=>{ if(e.target.id==='nbaPopup') hidePopup(); });
document.getElementById('nbaAuthModal').addEventListener('click',(e)=>{ if(e.target.id==='nbaAuthModal') hideAuthModal(); });
Promise.all([refreshMe(), loadExisting()]).then(()=>renderNBA());
