const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// Mock database pool layer so tests execute in memory without needing an active MySQL instance
jest.mock('../src/db', () => ({
  query: jest.fn(),
  getConnection: jest.fn()
}));

const pool = require('../src/db');
const app = require('../src/app');

describe('E-Commerce Backend API Tests', () => {
  const JWT_SECRET = process.env.JWT_SECRET || 'ecommerce_jwt_dev_secret_key_12345';

  // Helper to generate a valid test JWT
  function generateTestToken(user = { id: 1, email: 'test@example.com', role: 'customer' }) {
    return jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. GET /health
  describe('GET /health', () => {
    it('should return 200 with status "ok"', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });

  // 2. GET /api/products
  describe('GET /api/products', () => {
    it('should return 200 and a list of catalog products including image_url', async () => {
      const mockProducts = [
        { id: 1, name: 'Product A', description: 'Desc A', price: '19.99', stock: 10, image_url: '/images/products/headphones.jpg', created_at: new Date().toISOString() },
        { id: 2, name: 'Product B', description: 'Desc B', price: '49.50', stock: 5, image_url: '/images/products/keyboard.jpg', created_at: new Date().toISOString() }
      ];
      pool.query.mockResolvedValueOnce([mockProducts]);

      const res = await request(app).get('/api/products');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].price).toBe(19.99);
      expect(res.body[0].image_url).toBe('/images/products/headphones.jpg');
      expect(pool.query).toHaveBeenCalledTimes(1);
    });
  });

  // 3. Login with wrong password
  describe('POST /api/auth/login', () => {
    it('should return 401 when given an incorrect password', async () => {
      const hashedPassword = await bcrypt.hash('correctPassword123', 10);
      pool.query.mockResolvedValueOnce([
        [{ id: 1, email: 'user@example.com', password_hash: hashedPassword, role: 'customer' }]
      ]);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: 'wrongPassword' });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Invalid email or password.' });
    });

    it('should return 401 when email is not found', async () => {
      pool.query.mockResolvedValueOnce([[]]);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Invalid email or password.' });
    });
  });

  // 4. Protected route without token
  describe('Protected Route Authentication', () => {
    it('should return 401 on protected route without a token', async () => {
      const res = await request(app).get('/api/cart');
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Access token required' });
    });

    it('should return 403 when token is invalid or malformed', async () => {
      const res = await request(app)
        .get('/api/cart')
        .set('Authorization', 'Bearer invalid.token.payload');
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Invalid or expired token' });
    });
  });

  // 5. Creating an order with insufficient stock fails
  describe('POST /api/orders (Stock validation)', () => {
    it('should fail with 400 when an item in the cart exceeds available stock', async () => {
      const token = generateTestToken({ id: 2, email: 'shopper@example.com', role: 'customer' });

      // Mock database transaction connection
      const mockConnection = {
        beginTransaction: jest.fn().mockResolvedValue(),
        query: jest.fn(),
        commit: jest.fn().mockResolvedValue(),
        rollback: jest.fn().mockResolvedValue(),
        release: jest.fn()
      };

      // Mock cart contents: user requested 5, but stock is only 2
      const mockCartItems = [
        {
          cart_item_id: 1,
          product_id: 10,
          quantity: 5,
          name: 'Limited Edition Keyboard',
          price: '89.00',
          stock: 2
        }
      ];

      mockConnection.query.mockResolvedValueOnce([mockCartItems]);
      pool.getConnection.mockResolvedValueOnce(mockConnection);

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Insufficient stock');
      expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
      expect(mockConnection.commit).not.toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });
  });

  // 6. Cart and order total calculation
  describe('Total Calculation on Server', () => {
    it('should calculate cart subtotal and total accurately from database prices', async () => {
      const token = generateTestToken({ id: 3, email: 'calc@example.com', role: 'customer' });

      // Mock 2 items in cart:
      // Item 1: 2 units * $19.99 = $39.98
      // Item 2: 3 units * $10.00 = $30.00
      // Expected total: $69.98
      const mockCartRows = [
        { cart_item_id: 101, product_id: 1, quantity: 2, name: 'Item 1', price: '19.99', stock: 10 },
        { cart_item_id: 102, product_id: 2, quantity: 3, name: 'Item 2', price: '10.00', stock: 10 }
      ];

      pool.query.mockResolvedValueOnce([mockCartRows]);

      const res = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items[0].subtotal).toBe(39.98);
      expect(res.body.items[1].subtotal).toBe(30.00);
      expect(res.body.total).toBe(69.98);
    });

    it('should compute order total from server-side prices and store in order record', async () => {
      const token = generateTestToken({ id: 3, email: 'calc@example.com', role: 'customer' });

      const mockConnection = {
        beginTransaction: jest.fn().mockResolvedValue(),
        query: jest.fn(),
        commit: jest.fn().mockResolvedValue(),
        rollback: jest.fn().mockResolvedValue(),
        release: jest.fn()
      };

      // Item: 2 * $49.99 = $99.98
      const mockCartItems = [
        { cart_item_id: 201, product_id: 5, quantity: 2, name: 'Adapter', price: '49.99', stock: 50 }
      ];

      // 1. SELECT cart items
      mockConnection.query.mockResolvedValueOnce([mockCartItems]);
      // 2. INSERT into orders
      mockConnection.query.mockResolvedValueOnce([{ insertId: 77 }]);
      // 3. INSERT order_items
      mockConnection.query.mockResolvedValueOnce([{}]);
      // 4. UPDATE products stock
      mockConnection.query.mockResolvedValueOnce([{}]);
      // 5. DELETE cart_items
      mockConnection.query.mockResolvedValueOnce([{}]);

      pool.getConnection.mockResolvedValueOnce(mockConnection);

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(201);
      expect(res.body.order.id).toBe(77);
      expect(res.body.order.total).toBe(99.98);
      expect(mockConnection.commit).toHaveBeenCalledTimes(1);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);

      // Verify that the orders INSERT statement was called with the server-calculated 99.98
      const insertOrderCall = mockConnection.query.mock.calls.find(call => 
        typeof call[0] === 'string' && call[0].includes('INSERT INTO orders')
      );
      expect(insertOrderCall).toBeDefined();
      expect(insertOrderCall[1]).toEqual([3, 99.98, 'pending']);
    });
  });
  // Product image uploads (stored in products.image_url)
  describe('POST /api/products (image upload)', () => {
    const admin = () => generateTestToken({ id: 1, email: 'admin@example.com', role: 'admin' });
    const base = { name: 'Lamp', description: 'Desk lamp', price: 20, stock: 3 };

    it('stores an uploaded photo sent as a base64 data URL', async () => {
      const photo = 'data:image/jpeg;base64,' + 'A'.repeat(200 * 1024);
      pool.query.mockResolvedValueOnce([{ insertId: 42 }]);

      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${admin()}`)
        .send({ ...base, image_url: photo });

      expect(res.status).toBe(201);
      expect(res.body.product.image_url).toBe(photo);
      expect(pool.query.mock.calls[0][1][4]).toBe(photo);
    });

    it('rejects images that are not pictures', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${admin()}`)
        .send({ ...base, image_url: 'data:text/html;base64,PHNjcmlwdD4=' });

      expect(res.status).toBe(400);
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('rejects javascript: URLs', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${admin()}`)
        .send({ ...base, image_url: 'javascript:alert(1)' });

      expect(res.status).toBe(400);
    });
  });

  // Checkout payments
  describe('POST /api/orders (payment)', () => {
    function mockCheckout() {
      const connection = {
        beginTransaction: jest.fn().mockResolvedValue(),
        query: jest.fn(),
        commit: jest.fn().mockResolvedValue(),
        rollback: jest.fn().mockResolvedValue(),
        release: jest.fn()
      };
      connection.query
        .mockResolvedValueOnce([[{ cart_item_id: 1, product_id: 5, quantity: 1, name: 'Hub', price: '29.99', stock: 9 }]])
        .mockResolvedValueOnce([{ insertId: 12 }])
        .mockResolvedValue([{}]);
      pool.getConnection.mockResolvedValueOnce(connection);
      return connection;
    }
    const token = () => generateTestToken({ id: 4, email: 'pay@example.com', role: 'customer' });

    it('marks a card-paid order as paid and stores only brand and last 4 digits', async () => {
      const connection = mockCheckout();
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token()}`)
        .send({ payment: { method: 'card', cardBrand: 'Visa', cardLast4: '4242' } });

      expect(res.status).toBe(201);
      expect(res.body.order.status).toBe('paid');
      expect(res.body.order.paymentDetails).toBe('Visa •••• 4242');
      const insert = connection.query.mock.calls.find((c) => c[0].includes('INSERT INTO orders'));
      expect(insert[1]).toEqual([4, 29.99, 'paid', 'card', 'Visa •••• 4242']);
    });

    it('accepts PayPal with an email', async () => {
      mockCheckout();
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token()}`)
        .send({ payment: { method: 'paypal', email: 'buyer@example.com' } });

      expect(res.status).toBe(201);
      expect(res.body.order.paymentMethod).toBe('paypal');
    });

    it('rejects unknown payment methods before opening a transaction', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token()}`)
        .send({ payment: { method: 'bitcoin' } });

      expect(res.status).toBe(400);
      expect(pool.getConnection).not.toHaveBeenCalled();
    });

    it('rejects a full card number', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token()}`)
        .send({ payment: { method: 'card', cardLast4: '4242424242424242' } });

      expect(res.status).toBe(400);
    });
  });
});
