async function loadMerch(){
  const statusEl = document.getElementById('merchStatus');
  const grid = document.getElementById('merchGrid');
  statusEl.textContent = 'Loading merch...';
  statusEl.className = 'merchStatus';
  try{
    const res = await fetch('/api/merch-products', { headers:{ accept:'application/json' } });
    const data = await res.json();
    if(!res.ok || !data?.ok) throw new Error(data?.error || 'Unable to load merch');
    renderProducts(data.products || [], grid, statusEl);
  }catch(e){
    statusEl.textContent = e.message || 'Unable to load merch right now.';
    statusEl.className = 'merchStatus error';
  }
}

function renderProducts(products, grid, statusEl){
  if(!products.length){
    statusEl.textContent = 'Nothing is live yet.';
    statusEl.className = 'merchStatus';
    grid.innerHTML = '';
    return;
  }
  statusEl.textContent = '';
  statusEl.className = 'merchStatus';
  grid.innerHTML = products.map(product => {
    const variantOptions = (product.variants || []).map(v => {
      const disabled = v.sold_out ? 'disabled' : '';
      const soldText = v.sold_out ? ' — Sold Out' : ` — ${v.quantity_available} left`;
      return `<option value="${escapeHtml(v.id)}" ${disabled}>${escapeHtml(v.label)}${escapeHtml(soldText)}</option>`;
    }).join('');
    const firstAvailable = (product.variants || []).find(v => !v.sold_out);
    const stockText = product.sold_out ? 'Sold Out' : `${product.total_available} left`;
    return `
      <article class="merchCard" data-product-id="${escapeHtml(product.id)}">
        <div class="merchImageWrap">
          <img src="${escapeAttribute(product.image || '/images/merch-shirt-placeholder.svg')}" alt="${escapeAttribute(product.title)}" loading="lazy"/>
        </div>
        <div class="merchBody">
          <div class="merchTopRow">
            <h3 class="merchTitle">${escapeHtml(product.title)}</h3>
            <div class="merchPrice">${escapeHtml(product.price_label)}</div>
          </div>
          <div class="merchDesc">${escapeHtml(product.description || '')}</div>
          <div>
            ${product.drop_note ? `<span class="dropPill">${escapeHtml(product.drop_note)}</span>` : ''}
            <span class="stockPill ${product.sold_out ? 'sold' : ''}">${escapeHtml(stockText)}</span>
          </div>
          <div class="merchLabel">Size</div>
          <select class="merchSelect" ${product.sold_out ? 'disabled' : ''}>
            ${variantOptions}
          </select>
          <button class="merchBuyBtn" ${product.sold_out || !firstAvailable ? 'disabled' : ''}>${product.sold_out ? 'Sold Out' : 'Buy Now'}</button>
          <div class="merchFoot">
            <span>Fast Stripe checkout</span>
            <span>Limited drop</span>
          </div>
        </div>
      </article>
    `;
  }).join('');

  Array.from(grid.querySelectorAll('.merchCard')).forEach(card => {
    const button = card.querySelector('.merchBuyBtn');
    const select = card.querySelector('.merchSelect');
    button?.addEventListener('click', async () => {
      const variantId = select?.value || '';
      if(!variantId) return;
      await startCheckout(variantId, button, statusEl);
    });
  });
}

async function startCheckout(variantId, button, statusEl){
  const original = button.textContent;
  button.disabled = true;
  button.textContent = 'Starting checkout...';
  statusEl.textContent = '';
  try{
    const res = await fetch('/api/merch-checkout', {
      method: 'POST',
      headers: { 'content-type':'application/json', accept:'application/json' },
      body: JSON.stringify({ variant_id: variantId })
    });
    const data = await res.json();
    if(!res.ok || !data?.ok || !data?.url) throw new Error(data?.error || 'Unable to start checkout');
    window.location.href = data.url;
  }catch(e){
    button.disabled = false;
    button.textContent = original;
    statusEl.textContent = e.message || 'Unable to start checkout.';
    statusEl.className = 'merchStatus error';
    loadMerch();
  }
}

function escapeHtml(value){
  return String(value || '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
}
function escapeAttribute(value){ return escapeHtml(value); }

loadMerch();
