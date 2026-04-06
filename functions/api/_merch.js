import { MERCH_CATALOG, getMerchProduct } from './_merch_catalog.js';

const HOLD_MINUTES = 20;

export async function ensureMerchSchema(env){
  if(!env?.DB) throw new Error("Missing D1 binding 'DB'.");
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS merch_inventory (
    product_id TEXT NOT NULL,
    size TEXT NOT NULL,
    total_qty INTEGER NOT NULL DEFAULT 0,
    available_qty INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (product_id, size)
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS merch_holds (
    session_id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    size TEXT NOT NULL,
    qty INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL,
    expires_at TEXT,
    created_at TEXT NOT NULL,
    released_at TEXT,
    completed_at TEXT
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS merch_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    product_id TEXT NOT NULL,
    size TEXT NOT NULL,
    qty INTEGER NOT NULL DEFAULT 1,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'usd',
    customer_email TEXT,
    shipping_name TEXT,
    shipping_json TEXT,
    stripe_payment_status TEXT,
    created_at TEXT NOT NULL
  )`).run();
}

export async function seedMerchInventory(env){
  await ensureMerchSchema(env);
  for(const product of MERCH_CATALOG){
    for(const row of (product.sizes || [])){
      const existing = await env.DB.prepare(
        'SELECT product_id FROM merch_inventory WHERE product_id=? AND size=?'
      ).bind(product.id, row.size).first();
      if(!existing){
        await env.DB.prepare(
          'INSERT INTO merch_inventory (product_id,size,total_qty,available_qty) VALUES (?,?,?,?)'
        ).bind(product.id, row.size, Number(row.qty || 0), Number(row.qty || 0)).run();
      }
    }
  }
}

export async function cleanupExpiredHolds(env){
  await ensureMerchSchema(env);
  const nowIso = new Date().toISOString();
  const expired = await env.DB.prepare(
    "SELECT session_id, product_id, size, qty FROM merch_holds WHERE status='held' AND expires_at IS NOT NULL AND expires_at <= ?"
  ).bind(nowIso).all();
  for(const hold of (expired.results || [])){
    await env.DB.prepare(
      'UPDATE merch_inventory SET available_qty = available_qty + ? WHERE product_id=? AND size=?'
    ).bind(hold.qty || 1, hold.product_id, hold.size).run();
    await env.DB.prepare(
      "UPDATE merch_holds SET status='expired', released_at=? WHERE session_id=? AND status='held'"
    ).bind(nowIso, hold.session_id).run();
  }
}

export async function getCatalogWithInventory(env){
  await seedMerchInventory(env);
  await cleanupExpiredHolds(env);
  const inv = await env.DB.prepare('SELECT product_id,size,total_qty,available_qty FROM merch_inventory').all();
  const invMap = new Map();
  for(const row of (inv.results || [])){
    invMap.set(`${row.product_id}__${row.size}`, row);
  }
  return MERCH_CATALOG.map(product => {
    const sizes = (product.sizes || []).map(s => {
      const live = invMap.get(`${product.id}__${s.size}`);
      const availableQty = Number(live?.available_qty ?? s.qty ?? 0);
      return {
        size: s.size,
        availableQty,
        soldOut: availableQty <= 0
      };
    });
    const totalAvailableQty = sizes.reduce((sum, s) => sum + Number(s.availableQty || 0), 0);
    return {
      ...product,
      sizes,
      totalAvailableQty,
      soldOut: totalAvailableQty <= 0
    };
  });
}

export async function holdInventory(env, { sessionId, productId, size, qty = 1 }){
  await seedMerchInventory(env);
  await cleanupExpiredHolds(env);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + HOLD_MINUTES * 60 * 1000).toISOString();
  const res = await env.DB.prepare(
    'UPDATE merch_inventory SET available_qty = available_qty - ? WHERE product_id=? AND size=? AND available_qty >= ?'
  ).bind(qty, productId, size, qty).run();
  if(!res.success || !res.meta || !res.meta.changes){
    return { ok:false, error:'sold_out' };
  }
  await env.DB.prepare(
    'INSERT OR REPLACE INTO merch_holds (session_id, product_id, size, qty, status, expires_at, created_at) VALUES (?,?,?,?,?,?,?)'
  ).bind(sessionId, productId, size, qty, 'held', expiresAt, now.toISOString()).run();
  return { ok:true, expiresAt };
}

export async function releaseHold(env, sessionId){
  await ensureMerchSchema(env);
  const hold = await env.DB.prepare('SELECT * FROM merch_holds WHERE session_id=?').bind(sessionId).first();
  if(!hold) return { ok:true, released:false, reason:'missing' };
  if(hold.status !== 'held') return { ok:true, released:false, reason:hold.status };
  const nowIso = new Date().toISOString();
  await env.DB.prepare(
    'UPDATE merch_inventory SET available_qty = available_qty + ? WHERE product_id=? AND size=?'
  ).bind(hold.qty || 1, hold.product_id, hold.size).run();
  await env.DB.prepare(
    "UPDATE merch_holds SET status='released', released_at=? WHERE session_id=? AND status='held'"
  ).bind(nowIso, sessionId).run();
  return { ok:true, released:true };
}

export async function completeOrder(env, payload){
  await ensureMerchSchema(env);
  const { sessionId, productId, size, qty, amountCents, currency='usd', customerEmail='', shippingName='', shippingJson='{}', paymentStatus='' } = payload;
  await env.DB.prepare(
    `INSERT OR IGNORE INTO merch_orders
     (session_id, product_id, size, qty, amount_cents, currency, customer_email, shipping_name, shipping_json, stripe_payment_status, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(sessionId, productId, size, qty, amountCents, currency, customerEmail, shippingName, shippingJson, paymentStatus, new Date().toISOString()).run();
  await env.DB.prepare(
    "UPDATE merch_holds SET status='completed', completed_at=? WHERE session_id=? AND status='held'"
  ).bind(new Date().toISOString(), sessionId).run();
}

export function merchPriceLabel(priceCents){
  return `$${(Number(priceCents || 0) / 100).toFixed(2)}`;
}

export function buildStripeSessionParams({ origin, product, size, sessionId }){
  const amount = Number(product.priceCents || 0);
  const body = new URLSearchParams();
  body.set('mode', 'payment');
  body.set('success_url', `${origin}/merch/success?session_id={CHECKOUT_SESSION_ID}`);
  body.set('cancel_url', `${origin}/merch/cancel?session_id={CHECKOUT_SESSION_ID}`);
  body.set('shipping_address_collection[allowed_countries][0]', 'US');
  body.set('billing_address_collection', 'required');
  body.set('phone_number_collection[enabled]', 'true');
  body.set('allow_promotion_codes', 'true');
  body.set('submit_type', 'pay');
  body.set('client_reference_id', sessionId);
  body.set('payment_intent_data[metadata][product_id]', product.id);
  body.set('payment_intent_data[metadata][size]', size);
  body.set('payment_intent_data[metadata][session_id]', sessionId);
  body.set('metadata[product_id]', product.id);
  body.set('metadata[size]', size);
  body.set('metadata[session_id]', sessionId);
  body.set('line_items[0][quantity]', '1');
  body.set('line_items[0][price_data][currency]', 'usd');
  body.set('line_items[0][price_data][unit_amount]', String(amount));
  body.set('line_items[0][price_data][product_data][name]', product.title);
  body.set('line_items[0][price_data][product_data][description]', `${product.description} • Size ${size}`);
  if(product.image){
    body.set('line_items[0][price_data][product_data][images][0]', `${origin}${product.image}`);
  }
  return body;
}

export async function fetchStripeSession(env, sessionId){
  const secret = env.STRIPE_SECRET_KEY;
  if(!secret) throw new Error('Missing STRIPE_SECRET_KEY');
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=shipping_cost&expand[]=customer_details&expand[]=line_items&expand[]=payment_intent.shipping`, {
    headers: { authorization: `Bearer ${secret}` }
  });
  if(!res.ok){
    throw new Error(`Stripe session fetch failed ${res.status}`);
  }
  return await res.json();
}

export { getMerchProduct };
