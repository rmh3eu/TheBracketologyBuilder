import { json } from './_util.js';
import { releaseReservation } from './_merch.js';

export async function onRequestPost({ request, env }){
  try{
    const body = await request.json().catch(()=>null);
    const reservationId = String(body?.reservation_id || '').trim();
    if(!reservationId) return json({ ok:false, error:'reservation_id required' }, 400);
    const out = await releaseReservation(env, reservationId);
    return json({ ok:true, ...out });
  }catch(e){
    return json({ ok:false, error: e.message || 'Unable to release reservation' }, 500);
  }
}
