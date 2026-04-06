export const MERCH_CATALOG = [
  {
    id: 'bracket-champion-shirt',
    title: 'Bracket Champion Shirt',
    description: 'Limited drop tee from BracketologyBuilder. Clean front graphic. Creator-merch pricing.',
    priceCents: 2400,
    image: '/prizes/custom-gear-bracket-champion.png',
    category: 'shirt',
    featured: true,
    sizes: [
      { size: 'M', qty: 25 },
      { size: 'L', qty: 25 },
      { size: 'XL', qty: 20 }
    ]
  },
  {
    id: 'knows-ball-shirt',
    title: 'Knows Ball Shirt',
    description: 'Soft limited-run tee. Easy everyday wear.',
    priceCents: 2200,
    image: '/prizes/custom-gear-knows-ball.png',
    category: 'shirt',
    sizes: [
      { size: 'M', qty: 25 },
      { size: 'L', qty: 25 }
    ]
  },
  {
    id: 'busted-bracket-club-shirt',
    title: 'Busted Bracket Club Shirt',
    description: 'For the real tournament sickos. Limited inventory.',
    priceCents: 2200,
    image: '/prizes/custom-gear-busted-bracket.png',
    category: 'shirt',
    sizes: [
      { size: 'M', qty: 25 },
      { size: 'L', qty: 25 }
    ]
  },
  {
    id: 'doesnt-know-ball-shirt',
    title: "Doesn't Know Ball Shirt",
    description: 'Funny drop tee. Great as a gift or a bad beat uniform.',
    priceCents: 2200,
    image: '/prizes/custom-gear-doesnt-know-ball.png',
    category: 'shirt',
    sizes: [
      { size: 'L', qty: 25 },
      { size: 'XL', qty: 20 },
      { size: 'XXL', qty: 15 }
    ]
  },
  {
    id: 'track-jacket',
    title: 'Bracketology Builder Track Jacket',
    description: 'Premium zip-up track jacket from the custom gear collection.',
    priceCents: 4200,
    image: '/prizes/custom-gear-track-jacket.png',
    category: 'jacket',
    sizes: [
      { size: 'M', qty: 25 },
      { size: 'L', qty: 25 }
    ]
  },
  {
    id: 'track-jacket-alt',
    title: 'Bracketology Builder Track Jacket (Alt Design)',
    description: 'Alternate track jacket design with the same limited-drop feel.',
    priceCents: 4200,
    image: '/prizes/custom-gear-track-jacket-2.png',
    category: 'jacket',
    sizes: [
      { size: 'M', qty: 25 }
    ]
  },
  {
    id: 'basketball-backpack',
    title: 'Basketball Backpack',
    description: 'Everyday bag from the custom gear section.',
    priceCents: 3000,
    image: '/prizes/custom-gear-backpack-1.png',
    category: 'backpack',
    sizes: [
      { size: 'One Size', qty: 15 }
    ]
  },
  {
    id: 'basketball-backpack-alt',
    title: 'Basketball Backpack (Alt Design)',
    description: 'Alternate backpack design. Small drop, easy gift item.',
    priceCents: 3000,
    image: '/prizes/custom-gear-backpack-2.png',
    category: 'backpack',
    sizes: [
      { size: 'One Size', qty: 15 }
    ]
  }
];

export function getMerchProduct(productId){
  return MERCH_CATALOG.find(p => p.id === productId) || null;
}
