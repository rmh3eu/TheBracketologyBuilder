import { json } from './_util.js';
import { getCatalogWithInventory } from './_merch.js';

export async function onRequestGet({ env }){
  const products = await getCatalogWithInventory(env);
  return json({ ok:true, products });
}
