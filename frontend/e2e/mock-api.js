// In-memory fake of the Express backend, wired into Playwright's request routing.
// Responses mirror the real controllers in backend/src/controllers.

const SEED_PRODUCTS = [
  { id: 1, name: 'Wireless Noise-Canceling Headphones', description: 'Premium over-ear headphones with 30-hour battery life.', price: 149.99, stock: 45, image_url: '/images/products/headphones.jpg' },
  { id: 2, name: 'Mechanical Gaming Keyboard', description: 'RGB backlit mechanical keyboard with tactile blue switches.', price: 79.99, stock: 30, image_url: '/images/products/keyboard.jpg' },
  { id: 3, name: 'Ergonomic Wireless Mouse', description: 'Precision optical mouse with customizable shortcut buttons.', price: 39.5, stock: 60, image_url: '/images/products/mouse.jpg' },
  { id: 4, name: 'Ultra-Wide Curved Gaming Monitor 34-inch', description: '144Hz refresh rate, WQHD HDR display.', price: 429.0, stock: 5, image_url: '/images/products/monitor.jpg' },
  { id: 5, name: 'Studio Condenser Microphone', description: 'Cardioid USB microphone with boom arm.', price: 64.95, stock: 0, image_url: '/images/products/microphone.jpg' },
];

const USERS = [
  { id: 1, email: 'admin@example.com', password: 'admin123', role: 'admin' },
  { id: 2, email: 'customer@example.com', password: 'customer123', role: 'customer' },
];

// payments: what GET /api/payments/config answers. Defaults to the demo checkout.
export async function mockApi(page, { payments = { currency: 'usd', demo: true, stripe: null, paypal: null } } = {}) {
  const db = {
    products: SEED_PRODUCTS.map((p) => ({ ...p, created_at: '2026-10-15T12:00:00.000Z' })),
    users: USERS.map((u) => ({ ...u })),
    carts: new Map(), // userId -> Map(productId -> quantity)
    orders: [],
    nextProductId: 100,
    nextOrderId: 1,
    paymentConfig: payments,
    stripeIntents: 0,
  };

  const json = (route, status, body) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  const userFromToken = (request) => {
    const header = request.headers()['authorization'] || '';
    const id = Number(header.replace('Bearer fake-token-', ''));
    return db.users.find((u) => u.id === id) || null;
  };

  const cartOf = (userId) => {
    if (!db.carts.has(userId)) db.carts.set(userId, new Map());
    return db.carts.get(userId);
  };

  // Match on pathname so Vite source modules like /src/api/client.js are not intercepted.
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname;
    const body = request.postDataJSON?.() ?? null;
    const user = userFromToken(request);

    // ---- Auth ----
    if (path === '/api/auth/login' && method === 'POST') {
      const u = db.users.find((x) => x.email === body.email?.toLowerCase() && x.password === body.password);
      if (!u) return json(route, 401, { error: 'Invalid email or password.' });
      return json(route, 200, {
        message: 'Login successful',
        token: `fake-token-${u.id}`,
        user: { id: u.id, email: u.email, role: u.role },
      });
    }
    if (path === '/api/auth/register' && method === 'POST') {
      const email = body.email?.trim().toLowerCase();
      if (db.users.some((u) => u.email === email)) {
        return json(route, 409, { error: 'An account with this email already exists.' });
      }
      const u = { id: db.users.length + 1, email, password: body.password, role: 'customer' };
      db.users.push(u);
      return json(route, 201, { message: 'User registered successfully', user: { id: u.id, email, role: 'customer' } });
    }

    // ---- Products ----
    const productMatch = path.match(/^\/api\/products\/(\d+)$/);
    if (path === '/api/products' && method === 'GET') {
      const q = (url.searchParams.get('search') || '').toLowerCase();
      return json(
        route,
        200,
        db.products.filter((p) => !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
      );
    }
    if (productMatch && method === 'GET') {
      const p = db.products.find((x) => x.id === Number(productMatch[1]));
      return p ? json(route, 200, p) : json(route, 404, { error: 'Product not found' });
    }
    if (path.startsWith('/api/products') && ['POST', 'PUT', 'DELETE'].includes(method)) {
      if (!user) return json(route, 401, { error: 'Access token required' });
      if (user.role !== 'admin') return json(route, 403, { error: 'Forbidden: Admin access required' });
      if (method === 'POST') {
        const p = { id: db.nextProductId++, ...body, created_at: new Date().toISOString() };
        db.products.push(p);
        return json(route, 201, { message: 'Product created successfully', product: p });
      }
      const idx = db.products.findIndex((x) => x.id === Number(productMatch?.[1]));
      if (idx === -1) return json(route, 404, { error: 'Product not found.' });
      if (method === 'PUT') {
        db.products[idx] = { ...db.products[idx], ...body };
        return json(route, 200, { message: 'Product updated successfully', product: db.products[idx] });
      }
      db.products.splice(idx, 1);
      return json(route, 200, { message: 'Product deleted successfully' });
    }

    // ---- Payments ----
    if (path === '/api/payments/config' && method === 'GET') return json(route, 200, db.paymentConfig);
    if (path === '/api/payments/stripe/intent' && method === 'POST') {
      if (!user) return json(route, 401, { error: 'Access token required' });
      db.stripeIntents += 1;
      return json(route, 200, { clientSecret: `pi_test_${db.stripeIntents}_secret_x`, amount: 0 });
    }

    // ---- Cart & orders (authenticated) ----
    if (path.startsWith('/api/cart') || path.startsWith('/api/orders')) {
      if (!user) return json(route, 401, { error: 'Access token required' });
      const cart = cartOf(user.id);

      const cartView = () => {
        const items = [...cart].map(([productId, quantity], i) => {
          const p = db.products.find((x) => x.id === productId);
          return {
            cartItemId: i + 1,
            productId,
            name: p.name,
            price: p.price,
            stock: p.stock,
            image_url: p.image_url ?? null,
            quantity,
            subtotal: Number((p.price * quantity).toFixed(2)),
          };
        });
        return { items, total: Number(items.reduce((s, i) => s + i.subtotal, 0).toFixed(2)) };
      };

      if (path === '/api/cart' && method === 'GET') return json(route, 200, cartView());
      if (path === '/api/cart' && method === 'POST') {
        const p = db.products.find((x) => x.id === Number(body.productId));
        if (!p) return json(route, 404, { error: 'Product not found.' });
        const next = (cart.get(p.id) || 0) + Number(body.quantity || 1);
        if (next > p.stock) {
          return json(route, 400, { error: `Insufficient stock for '${p.name}'. Available: ${p.stock}, in cart: ${cart.get(p.id) || 0}.` });
        }
        cart.set(p.id, next);
        return json(route, 200, { message: 'Item added to cart successfully' });
      }
      const cartMatch = path.match(/^\/api\/cart\/(\d+)$/);
      if (cartMatch && method === 'DELETE') {
        if (!cart.delete(Number(cartMatch[1]))) return json(route, 404, { error: 'Item not found in cart.' });
        return json(route, 200, { message: 'Item removed from cart successfully' });
      }

      if (path === '/api/orders' && method === 'POST') {
        const { items, total } = cartView();
        const payment = body?.payment ?? null;
        const methods = { card: 'Card', paypal: 'PayPal', apple_pay: 'Apple Pay', google_pay: 'Google Pay' };
        if (payment && !methods[payment.method]) return json(route, 400, { error: 'Unsupported payment method.' });
        if (payment?.method === 'card' && !/^\d{4}$/.test(payment.cardLast4 || '')) {
          return json(route, 400, { error: 'Card payments must include the last 4 digits only.' });
        }
        if (items.length === 0) return json(route, 400, { error: 'Cannot create order: Shopping cart is empty.' });
        const paymentDetails = !payment
          ? null
          : payment.method === 'card'
            ? `${payment.cardBrand || 'Card'} •••• ${payment.cardLast4}`
            : payment.method === 'paypal'
              ? `PayPal (${payment.email})`
              : methods[payment.method];
        const status = payment ? 'paid' : 'pending';
        db.lastPayment = payment;
        const order = {
          id: db.nextOrderId++,
          userId: user.id,
          total,
          status,
          paymentMethod: payment?.method ?? null,
          paymentDetails,
          createdAt: new Date().toISOString(),
          items: items.map((i, n) => ({
            id: n + 1,
            productId: i.productId,
            productName: i.name,
            quantity: i.quantity,
            unitPrice: i.price,
            subtotal: i.subtotal,
          })),
        };
        for (const i of items) db.products.find((p) => p.id === i.productId).stock -= i.quantity;
        cart.clear();
        db.orders.push(order);
        return json(route, 201, {
          message: 'Order created successfully',
          order: { id: order.id, userId: user.id, total, status, paymentMethod: order.paymentMethod, paymentDetails, itemsCount: items.length },
        });
      }
      if (path === '/api/orders' && method === 'GET') {
        return json(route, 200, db.orders.filter((o) => o.userId === user.id).reverse());
      }
      const receiptMatch = path.match(/^\/api\/orders\/(\d+)\/receipt$/);
      if (receiptMatch && method === 'GET') {
        const order = db.orders.find((o) => o.id === Number(receiptMatch[1]) && o.userId === user.id);
        if (!order) return json(route, 404, { error: 'Order not found.' });
        return route.fulfill({
          status: 200,
          contentType: 'application/pdf',
          headers: { 'Content-Disposition': `attachment; filename="kestrel-receipt-${order.id}.pdf"` },
          body: `%PDF-1.4 mock receipt for order #${order.id}`,
        });
      }
    }

    return json(route, 404, { error: `Route not found: ${method} ${path}` });
  });

  return db;
}

export async function loginAs(page, email, password) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}
