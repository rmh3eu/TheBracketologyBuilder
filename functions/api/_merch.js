import { MERCH_CATALOG, getCatalogVariant, formatPrice } from './_merch_catalog.js';
import { uid } from './_util.js';

const HOLD_MINUTES = 30;

export async function ensureMerchSchema(env){
  if(!env || !env.DB) throw new Error("Missing D1 binding 'DB'.");

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS merch_inventory (
    variant_id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    product_title TEXT NOT NULL,
    product_description TEXT,
    variant_label TEXT,
    image_path TEXT,
    price_cents INTEGER NOT NULL,
    quantity_total INTEGER NOT NULL DEFAULT 0,
    quantity_available INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
  );`).run();

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS merch_reservations (
    id TEXT PRIMARY KEY,
    variant_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    status TEXT NOT NULL,
    stripe_session_id TEXT,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    completed_at TEXT,
    released_at TEXT,
    buyer_email TEXT,
    request_ip TEXT,
    request_ua TEXT
  );`).run();

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS merch_orders (
    id TEXT PRIMARY KEY,
    reservation_id TEXT,
    stripe_session_id TEXT UNIQUE,
    stripe_payment_intent TEXT,
    variant_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    amount_total INTEGER,
    currency TEXT,
    buyer_email TEXT,
    created_at TEXT NOT NULL
  );`).run();

  try{ await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_merch_reservations_status_expires ON merch_reservations(status, expires_at)`).run(); }catch(_e){}
  try{ await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_merch_orders_variant ON merch_orders(variant_id)`).run(); }catch(_e){}
}

export async function syncMerchCatalog(env){
  await ensureMerchSchema(env);
  const nowIso = new Date().toISOString();

  for(const product of MERCH_CATALOG){
    for(const variant of (product.variants || [])){
      const existing = await env.DB.prepare(`SELECT quantity_total, quantity_available FROM merch_inventory WHERE variant_id = ?`).bind(variant.id).first();
      if(!existing){
        await env.DB.prepare(`INSERT INTO merch_inventory (
          variant_id, product_id, product_title, product_description, variant_label, image_path,
          price_cents, quantity_total, quantity_available, sort_order, active, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(
            variant.id,
            product.id,
            product.title,
            product.description || '',
            variant.label || '',
            product.image || '',
            Number(product.price_cents || 0),
            Number(variant.quantity || 0),
            Number(variant.quantity || 0),
            Number(product.sort_order || 0),
            product.active === false ? 0 : 1,
            nowIso
          ).run();
        continue;
      }

      const prevTotal = Number(existing.quantity_total || 0);
      const prevAvailable = Number(existing.quantity_available || 0);
      const sold = Math.max(0, prevTotal - prevAvailable);
      const nextTotal = Number(variant.quantity || 0);
      const nextAvailable = Math.max(0, nextTotal - sold);

      await env.DB.prepare(`UPDATE merch_inventory
        SET product_id = ?, product_title = ?, product_description = ?, variant_label = ?, image_path = ?,
            price_cents = ?, quantity_total = ?, quantity_available = ?, sort_order = ?, active = ?, updated_at = ?
        WHERE variant_id = ?`)
        .bind(
          product.id,
          product.title,
          product.description || '',
          variant.label || '',
          product.image || '',
          Number(product.price_cents || 0),
          nextTotal,
          nextAvailable,
          Number(product.sort_order || 0),
          product.active === false ? 0 : 1,
          nowIso,
          variant.id
        ).run();
    }
  }
}

export async function cleanupExpiredReservations(env){
  await ensureMerchSchema(env);
  const nowIso = new Date().toISOString();
  const rows = await env.DB.prepare(`SELECT id, variant_id, quantity FROM merch_reservations WHERE status = 'reserved' AND expires_at <= ?`).bind(nowIso).all().catch(()=>({results:[]}));
  const items = rows?.results || [];
  for(const row of items){
    await env.DB.prepare(`UPDATE merch_inventory SET quantity_available = quantity_available + ?, updated_at = ? WHERE variant_id = ?`).bind(Number(row.quantity || 0), nowIso, row.variant_id).run();
    await env.DB.prepare(`UPDATE merch_reservations SET status = 'released', released_at = ? WHERE id = ? AND status = 'reserved'`).bind(nowIso, row.id).run();
  }
  return items.length;
}

export async function getMerchProducts(env){
  await cleanupExpiredReservations(env);
  await syncMerchCatalog(env);

  const rs = await env.DB.prepare(`SELECT * FROM merch_inventory WHERE active = 1 ORDER BY sort_order ASC, product_title ASC, variant_label ASC`).all();
  const rows = rs?.results || [];
  const products = [];
  const byId = new Map();

  for(const row of rows){
    let item = byId.get(row.product_id);
    if(!item){
      item = {
        id: row.product_id,
        title: row.product_title,
        description: row.product_description || '',
        image: row.image_path || '',
        price_cents: Number(row.price_cents || 0),
        price_label: formatPrice(row.price_cents),
        total_available: 0,
        sold_out: true,
        variants: []
      };
      byId.set(row.product_id, item);
      products.push(item);
    }
    const available = Number(row.quantity_available || 0);
    item.total_available += available;
    if(available > 0) item.sold_out = false;
    item.variants.push({
      id: row.variant_id,
      label: row.variant_label || 'One size',
      quantity_available: available,
      sold_out: available <= 0,
      price_cents: Number(row.price_cents || 0),
      price_label: formatPrice(row.price_cents)
    });
  }

  for(const product of products){
    const catalogProduct = MERCH_CATALOG.find(p => p.id === product.id);
    if(catalogProduct && catalogProduct.drop_note) product.drop_note = catalogProduct.drop_note;
  }

  return { products, hold_minutes: HOLD_MINUTES };
}

export async function reserveMerchVariant(env, { variantId, quantity = 1, requestIp = '', requestUa = '' }){
  await cleanupExpiredReservations(env);
  await syncMerchCatalog(env);

  const catalogItem = getCatalogVariant(variantId);
  if(!catalogItem) throw new Error('Unknown merch variant');

  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000).toISOString();
  const reservationId = uid();

  const update = await env.DB.prepare(`UPDATE merch_inventory
    SET quantity_available = quantity_available - ?, updated_at = ?
    WHERE variant_id = ? AND active = 1 AND quantity_available >= ?`)
    .bind(Number(quantity || 1), nowIso, variantId, Number(quantity || 1)).run();

  const changed = Number(update?.meta?.changes || 0);
  if(changed < 1){
    const err = new Error('Sold out');
    err.code = 'SOLD_OUT';
    throw err;
  }

  await env.DB.prepare(`INSERT INTO merch_reservations (
    id, variant_id, product_id, quantity, status, created_at, expires_at, request_ip, request_ua
  ) VALUES (?, ?, ?, ?, 'reserved', ?, ?, ?, ?)`)
    .bind(reservationId, variantId, catalogItem.product.id, Number(quantity || 1), nowIso, expiresAt, requestIp || '', requestUa || '').run();

  return {
    reservationId,
    expiresAt,
    product: catalogItem.product,
    variant: catalogItem.variant,
    quantity: Number(quantity || 1)
  };
}

export async function releaseReservation(env, reservationId){
  if(!reservationId) return { ok:false, released:false };
  await ensureMerchSchema(env);
  const row = await env.DB.prepare(`SELECT id, variant_id, quantity, status FROM merch_reservations WHERE id = ?`).bind(reservationId).first();
  if(!row) return { ok:false, released:false, reason:'not_found' };
  if(row.status !== 'reserved') return { ok:true, released:false, status: row.status };
  const nowIso = new Date().toISOString();
  await env.DB.prepare(`UPDATE merch_inventory SET quantity_available = quantity_available + ?, updated_at = ? WHERE variant_id = ?`).bind(Number(row.quantity || 0), nowIso, row.variant_id).run();
  await env.DB.prepare(`UPDATE merch_reservations SET status = 'released', released_at = ? WHERE id = ? AND status = 'reserved'`).bind(nowIso, reservationId).run();
  return { ok:true, released:true };
}
