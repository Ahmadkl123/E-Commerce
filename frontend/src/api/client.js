// Thin wrapper around fetch for the Express backend.
// Every endpoint used by the UI lives here so components never build URLs themselves.

const BASE_URL = import.meta.env.VITE_API_URL || '';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

let authToken = null;
let onSessionExpired = null;

export function setAuthToken(token) {
  authToken = token;
}

export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler;
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the server. Is the backend running?', 0);
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    // 502-504 without a JSON body come from the dev proxy when the backend is down.
    const unreachable = !data && res.status >= 502 && res.status <= 504;
    const message = unreachable
      ? 'Cannot reach the server. Is the backend running on port 5000?'
      : data?.error || `Request failed (${res.status})`;
    // The backend answers 401 for a missing token and 403 "Invalid or expired token"
    // for a bad one; both mean the stored session is no longer usable.
    const sessionDead =
      authToken && (res.status === 401 || message === 'Invalid or expired token');
    if (sessionDead && onSessionExpired) onSessionExpired();
    throw new ApiError(message, res.status);
  }

  return data;
}

export const api = {
  health: () => request('/health'),

  // Auth
  login: (email, password) => request('/api/auth/login', { method: 'POST', body: { email, password } }),
  register: (email, password) =>
    request('/api/auth/register', { method: 'POST', body: { email, password } }),

  // Products
  getProducts: (search = '') =>
    request(`/api/products${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''}`),
  getProduct: (id) => request(`/api/products/${id}`),
  createProduct: (product) => request('/api/products', { method: 'POST', body: product }),
  updateProduct: (id, product) => request(`/api/products/${id}`, { method: 'PUT', body: product }),
  deleteProduct: (id) => request(`/api/products/${id}`, { method: 'DELETE' }),

  // Cart
  getCart: () => request('/api/cart'),
  addToCart: (productId, quantity = 1) =>
    request('/api/cart', { method: 'POST', body: { productId, quantity } }),
  removeFromCart: (productId) => request(`/api/cart/${productId}`, { method: 'DELETE' }),

  // Orders
  checkout: () => request('/api/orders', { method: 'POST' }),
  getOrders: () => request('/api/orders'),
};
