const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function formatPrice(value) {
  return currency.format(Number(value) || 0);
}

export function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export const LOW_STOCK = 10;
export const FREE_SHIPPING_THRESHOLD = 50;

export function stockStatus(stock) {
  if (stock <= 0) return { label: 'Sold out', tone: 'danger' };
  if (stock <= LOW_STOCK) return { label: `Only ${stock} left`, tone: 'warn' };
  return { label: 'In stock', tone: 'success' };
}
