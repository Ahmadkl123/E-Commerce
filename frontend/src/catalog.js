// Product images and categories can come directly from the database (image_url / imageUrl).
// If not present, they are gracefully derived from the product name.
// Preset photos live in public/images/products (see CREDITS.md there).

const RULES = [
  { re: /headphone|earbud|headset/i, image: 'headphones', category: 'audio' },
  { re: /microphone|\bmic\b/i, image: 'microphone', category: 'audio' },
  { re: /keyboard/i, image: 'keyboard', category: 'computing' },
  { re: /mouse/i, image: 'mouse', category: 'computing' },
  { re: /monitor|display/i, image: 'monitor', category: 'computing' },
  { re: /webcam|camera/i, image: 'webcam', category: 'computing' },
  { re: /hub|adapter|cable|usb/i, image: 'hub', category: 'accessories' },
  { re: /ssd|drive|storage/i, image: 'ssd', category: 'accessories' },
  { re: /stand|riser/i, image: 'stand', category: 'accessories' },
  { re: /watch|fitness/i, image: 'watch', category: 'wearables' },
];

export const CATEGORIES = [
  { slug: 'audio', label: 'Audio', image: '/images/site/cat-audio.jpg' },
  { slug: 'computing', label: 'Computing', image: '/images/site/cat-computing.jpg' },
  { slug: 'accessories', label: 'Accessories', image: '/images/site/cat-accessories.jpg' },
  { slug: 'wearables', label: 'Wearables', image: '/images/site/cat-wearables.jpg' },
];

function match(name = '') {
  return RULES.find((r) => r.re.test(name));
}

export function productImage(product) {
  if (product?.image_url && typeof product.image_url === 'string' && product.image_url.trim() !== '') {
    return product.image_url.trim();
  }
  if (product?.imageUrl && typeof product.imageUrl === 'string' && product.imageUrl.trim() !== '') {
    return product.imageUrl.trim();
  }
  const rule = match(product?.name);
  return rule ? `/images/products/${rule.image}.jpg` : '/images/products/placeholder.svg';
}

export function productCategory(product) {
  return match(product?.name)?.category ?? 'accessories';
}

export function categoryLabel(slug) {
  return CATEGORIES.find((c) => c.slug === slug)?.label ?? 'All products';
}
