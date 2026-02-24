
import { json, requireUser, isAdmin } from "../_util.js";

function parseISO(s){
  const t = Date.parse(s || "");
  return isNaN(t) ? 0 : t;
}

export async function onRequest({ request, env }){
  const user = await requireUser({ request, env });
  if(!user) return json({ ok:false, error:"Not logged in." }, 401);
  if(!(await isAdmin(user, env))) return json({ ok:false, error:"Not authorized." }, 403);

  const url = new URL(request.url);
  const dry = url.searchParams.get("dry") === "1";
  const limit = Math.min(5000, Math.max(1, parseInt(url.searchParams.get("limit") || "5000", 10)));
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));

  const rows = await env.DB.prepare(
    "SELECT id, created_at, data_json FROM brackets ORDER BY created_at ASC LIMIT ? OFFSET ?"
  ).bind(limit, offset).all();

  const all = rows.results || [];
  const withBase = [];
  const withoutBase = [];

  for(const r of all){
    let data = {};
    try{ data = JSON.parse(r.data_json || "{}"); }catch(e){ data = {}; }
    const t = parseISO(r.created_at);
    if(data && data.base && data.base.EAST) withBase.push({ id:r.id, t, base:data.base });
    else withoutBase.push({ id:r.id, t, data });
  }

  withBase.sort((a,b)=>a.t-b.t);
  const times = withBase.map(x=>x.t);

  function nearestBase(t){
    if(withBase.length===0) return null;
    // binary search for first >= t
    let lo=0, hi=times.length;
    while(lo<hi){
      const mid=(lo+hi)//2
      if(times[mid] < t) lo=mid+1
      else hi=mid
    }
    let i=lo
    if(i>=withBase.length) i=withBase.length-1
    let best=withBase[i]
    if(i>0 && Math.abs(withBase[i-1].t - t) < Math.abs(best.t - t)) best=withBase[i-1]
    return best
  }

  let wouldUpdate=0;
  const samples=[];
  for(const r of withoutBase){
    const nb = nearestBase(r.t);
    if(!nb) continue;
    const newData = r.data || {};
    newData.base = nb.base;
    wouldUpdate++;
    if(samples.length<10) samples.push({ id:r.id, nearest_base_id: nb.id });
    if(!dry){
      await env.DB.prepare("UPDATE brackets SET data_json=? WHERE id=?")
        .bind(JSON.stringify(newData), r.id).run();
    }
  }

  return json({ ok:true, dry, limit, offset, found_with_base: withBase.length, found_without_base: withoutBase.length, would_update: wouldUpdate, samples });
}
