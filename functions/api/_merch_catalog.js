// Phase 1 merch catalog.
// Update titles, prices, quantities, descriptions, and image paths here.
// Inventory sync preserves units already sold when you change quantity_total.

export const MERCH_CATALOG = [
  {
    id: 'champion-shirt-black',
    title: 'Bracket Champion Shirt',
    description: 'Clean limited-drop tee for the first BracketologyBuilder merch release.',
    price_cents: 3200,
    image: '/images/merch-shirt-placeholder.svg',
    drop_note: 'Only a few available',
    sort_order: 1,
    active: true,
    variants: [
      { id: 'champion-shirt-black-m', label: 'Medium', quantity: 3 },
      { id: 'champion-shirt-black-l', label: 'Large', quantity: 3 },
      { id: 'champion-shirt-black-xl', label: 'XL', quantity: 2 }
    ]
  },
  {
    id: 'final-four-shirt-cream',
    title: 'Final Four Shirt',
    description: 'Limited cream tee. Small run for people coming over from TikTok.',
    price_cents: 3200,
    image: '/images/merch-shirt-placeholder.svg',
    drop_note: 'Small limited run',
    sort_order: 2,
    active: true,
    variants: [
      { id: 'final-four-shirt-cream-m', label: 'Medium', quantity: 1 },
      { id: 'final-four-shirt-cream-l', label: 'Large', quantity: 1 }
    ]
  },
  {
    id: 'bracket-builder-tee',
    title: 'Bracket Builder Tee',
    description: 'Another simple drop option. Easy to swap out later.',
    price_cents: 3000,
    image: '/images/merch-shirt-placeholder.svg',
    drop_note: 'Very limited',
    sort_order: 3,
    active: true,
    variants: [
      { id: 'bracket-builder-tee-xl', label: 'XL', quantity: 1 }
    ]
  }
];

export function getCatalogVariant(variantId){
  for(const product of MERCH_CATALOG){
    for(const variant of (product.variants || [])){
      if(variant.id === variantId){
        return { product, variant };
      }
    }
  }
  return null;
}

export function formatPrice(cents){
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}
