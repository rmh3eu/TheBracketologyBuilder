const $ = (s) => document.querySelector(s);
const listEl = $('#merchGrid');
const statusEl = $('#merchStatus');
const yearEl = $('#yearNow');
if (yearEl) yearEl.textContent = new Date().getFullYear();

function money(cents){
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

function optionMarkup(size){
    return `<option value="${size.size}">${size.size}</option>`;
}

function cardMarkup(product){
  const featured = product.featured ? '<div class="merchBadge">Main Drop</div>' : '';
  const soldOut = '<div class="limitedPill">Available now</div>'; 
  const shirtClass = product.category === 'shirt' ? 'shirtCard' : '';
  const boostClass = ['knows-ball-shirt','busted-bracket-club-shirt','doesnt-know-ball-shirt'].includes(product.id) ? 'boostShirtImage' : '';
  const metaText = 'Available now. If a size runs low, we can restock it.';
  return `
    <article class="merchCard ${product.featured ? 'featuredCard' : ''} ${shirtClass} ${boostClass}" data-product-id="${product.id}">
      <div class="merchImageWrap">
        ${featured}
        ${soldOut}
        <img class="merchImage" src="${product.image}" alt="${product.title}" />
      </div>
      <div class="merchCardBody">
        <div class="merchTitleRow">
          <h3>${product.title}</h3>
          <div class="merchPrice">${money(product.priceCents)}</div>
        </div>
        <p class="merchDesc">${product.description || ''}</p>
        <div class="merchMeta">${metaText}</div>
        <div class="merchActions">
          <label class="sizeLabel">Size</label>
          <select class="sizeSelect">
            ${(product.sizes || []).map(optionMarkup).join('')}
          </select>
          <button class="buyBtn">Buy Now</button>
        </div>
      </div>
    </article>
  `;
}

async function loadProducts(){
  statusEl.textContent = 'Loading merch…';
  const res = await fetch('/api/merch-products');
  const data = await res.json();
  if(!data.ok) throw new Error(data.error || 'Could not load merch');
  const products = data.products || [];
  listEl.innerHTML = products.map(cardMarkup).join('');
  statusEl.textContent = '';
}

async function handleBuy(button){
  const card = button.closest('.merchCard');
  const productId = card?.dataset?.productId;
  const size = card.querySelector('.sizeSelect')?.value;
  if(!productId || !size) return;
  const original = button.textContent;
  button.disabled = true;
  button.textContent = 'Opening checkout…';
  try{
    const res = await fetch('/api/merch-checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId, size })
    });
    const data = await res.json();
    if(!res.ok || !data.ok || !data.url){
      throw new Error(data.error || 'Checkout failed');
    }
    window.location.href = data.url;
  }catch(err){
    button.disabled = false;
    button.textContent = original;
    statusEl.textContent = String(err.message || err);
  }
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.buyBtn');
  if(btn) handleBuy(btn);
});

loadProducts().catch(err => {
  statusEl.textContent = String(err.message || err);
});
