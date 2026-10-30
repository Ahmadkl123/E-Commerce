const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock database pool layer so tests execute in memory without needing an active MySQL instance
jest.mock('../src/db', () => ({
  query: jest.fn(),
  getConnection: jest.fn()
}));

const pool = require('../src/db');
const app = require('../src/app');

describe('GET /api/orders/:id/receipt', () => {
  const JWT_SECRET = process.env.JWT_SECRET || 'ecommerce_jwt_dev_secret_key_12345';
  const token = jwt.sign({ id: 1, email: 'test@example.com', role: 'customer' }, JWT_SECRET, { expiresIn: '1h' });

  const order = {
    id: 42,
    user_id: 1,
    total: '109.97',
    status: 'paid',
    payment_method: 'card',
    payment_details: 'Visa •••• 4242',
    payment_reference: null,
    created_at: new Date('2026-10-30T10:00:00Z'),
    email: 'test@example.com'
  };

  // Collects the binary body so the PDF bytes can be inspected.
  const binary = (res, callback) => {
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => callback(null, Buffer.concat(chunks)));
  };

  it('should return 401 without a token', async () => {
    const res = await request(app).get('/api/orders/42/receipt');
    expect(res.status).toBe(401);
  });

  it('should return 400 for an invalid order id', async () => {
    const res = await request(app).get('/api/orders/abc/receipt').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('should return 404 when the order does not exist', async () => {
    pool.query.mockResolvedValueOnce([[]]);
    const res = await request(app).get('/api/orders/42/receipt').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("should return 404 for another user's order", async () => {
    pool.query.mockResolvedValueOnce([[{ ...order, user_id: 2 }]]);
    const res = await request(app).get('/api/orders/42/receipt').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('should download a PDF receipt for the owner', async () => {
    pool.query
      .mockResolvedValueOnce([[order]])
      .mockResolvedValueOnce([[
        { quantity: 1, unit_price: '49.99', product_name: 'Headphones' },
        { quantity: 2, unit_price: '29.99', product_name: null }
      ]]);

    const res = await request(app)
      .get('/api/orders/42/receipt')
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse(binary);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe('attachment; filename="kestrel-receipt-42.pdf"');
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pool.query.mock.calls[1][1]).toEqual([42]);
  });
});
