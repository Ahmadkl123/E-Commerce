const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function formatPrice(value) {
  return currency.format(Number(value) || 0);
}

export function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const LOW_STOCK = 10;

export function stockStatus(stock) {
  if (stock <= 0) return { label: 'Out of stock', tone: 'danger' };
  if (stock <= LOW_STOCK) return { label: `Only ${stock} left`, tone: 'warn' };
  return { label: 'In stock', tone: 'success' };
}
