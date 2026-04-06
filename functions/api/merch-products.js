import { json } from './_util.js';
import { getMerchProducts } from './_merch.js';

export async function onRequestGet({ env }){
  try{
    const data = await getMerchProducts(env);
    return json({ ok:true, ...data });
  }catch(e){
    return json({ ok:false, error: e.message || 'Unable to load merch' }, 500);
  }
}
