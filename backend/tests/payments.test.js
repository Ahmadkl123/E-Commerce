const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/db', () => ({
  query: jest.fn(),
  getConnection: jest.fn()
}));

// Stand-in for the Stripe SDK: the same object is returned for every client.
const mockStripe = {
  paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
  refunds: { create: jest.fn() }
};
jest.mock('stripe', () => jest.fn(() => mockStripe));

const pool = require('../src/db');
const app = require('../src/app');

const JWT_SECRET = process.env.JWT_SECRET || 'ecommerce_jwt_dev_secret_key_12345';
const token = (id = 7) => jwt.sign({ id, email: 'buyer@example.com', role: 'customer' }, JWT_SECRET);

function mockConnection(cartItems) {
  const connection = {
    beginTransaction: jest.fn().mockResolvedValue(),
    query: jest.fn(),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
    release: jest.fn()
  };
  connection.query
    .mockResolvedValueOnce([cartItems])
    .mockResolvedValueOnce([{ insertId: 31 }])
    .mockResolvedValue([{}]);
  pool.getConnection.mockResolvedValueOnce(connection);
  return connection;
}

const CART = [{ cart_item_id: 1, product_id: 2, quantity: 2, name: 'Keyboard', price: '29.99', stock: 10 }];

function succeededIntent(overrides = {}) {
  return {
    id: 'pi_123',
    status: 'succeeded',
    amount_received: 5998,
    metadata: { userId: '7' },
    latest_charge: {
      payment_method_details: { type: 'card', card: { brand: 'visa', last4: '4242', wallet: null } }
    },
    ...overrides
  };
}

const payWithStripe = () =>
  request(app)
    .post('/api/orders')
    .set('Authorization', `Bearer ${token()}`)
    .send({ payment: { method: 'stripe', paymentIntentId: 'pi_123' } });

describe('Payments', () => {
  const saved = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...saved };
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_PUBLISHABLE_KEY;
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;
  });

  afterAll(() => {
    process.env = saved;
  });

  describe('without provider keys (demo mode)', () => {
    it('reports demo mode in the public config', async () => {
      const res = await request(app).get('/api/payments/config');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ demo: true, stripe: null, paypal: null });
    });

    it('refuses to create a Stripe payment', async () => {
      const res = await request(app).post('/api/payments/stripe/intent').set('Authorization', `Bearer ${token()}`);
      expect(res.status).toBe(503);
    });
  });

  describe('with Stripe configured', () => {
    beforeEach(() => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_x';
      process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_x';
    });

    it('exposes only the publishable key', async () => {
      const res = await request(app).get('/api/payments/config');
      expect(res.body).toMatchObject({ demo: false, stripe: { publishableKey: 'pk_test_x' } });
      expect(JSON.stringify(res.body)).not.toContain('sk_test_x');
    });

    it('creates a PaymentIntent for the server-side cart total', async () => {
      pool.query.mockResolvedValueOnce([[{ quantity: 2, price: '29.99', stock: 10, name: 'Keyboard' }]]);
      mockStripe.paymentIntents.create.mockResolvedValueOnce({ client_secret: 'pi_123_secret_abc' });

      const res = await request(app).post('/api/payments/stripe/intent').set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ clientSecret: 'pi_123_secret_abc', amount: 59.98 });
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 5998, currency: 'usd', metadata: { userId: '7' } })
      );
    });

    it('requires a payment to place an order', async () => {
      const res = await request(app).post('/api/orders').set('Authorization', `Bearer ${token()}`);
      expect(res.status).toBe(402);
      expect(pool.getConnection).not.toHaveBeenCalled();
    });

    it('rejects simulated payments', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token()}`)
        .send({ payment: { method: 'card', cardBrand: 'Visa', cardLast4: '4242' } });
      expect(res.status).toBe(400);
    });

    it('creates a paid order once Stripe confirms the payment', async () => {
      mockStripe.paymentIntents.retrieve.mockResolvedValueOnce(succeededIntent());
      pool.query.mockResolvedValueOnce([[]]); // payment reference not used yet
      const connection = mockConnection(CART);

      const res = await payWithStripe();

      expect(res.status).toBe(201);
      expect(res.body.order).toMatchObject({ status: 'paid', paymentDetails: 'Visa •••• 4242' });
      const insert = connection.query.mock.calls.find((c) => c[0].includes('INSERT INTO orders'));
      expect(insert[1]).toEqual([7, 59.98, 'paid', 'stripe', 'Visa •••• 4242', 'pi_123']);
      expect(mockStripe.refunds.create).not.toHaveBeenCalled();
    });

    it('names the wallet for Apple Pay and Google Pay payments', async () => {
      mockStripe.paymentIntents.retrieve.mockResolvedValueOnce(
        succeededIntent({
          latest_charge: {
            payment_method_details: {
              type: 'card',
              card: { brand: 'mastercard', last4: '4444', wallet: { type: 'google_pay' } }
            }
          }
        })
      );
      pool.query.mockResolvedValueOnce([[]]);
      mockConnection(CART);

      const res = await payWithStripe();

      expect(res.body.order.paymentDetails).toBe('Google Pay (Mastercard •••• 4444)');
    });

    it('refuses a payment that has not succeeded', async () => {
      mockStripe.paymentIntents.retrieve.mockResolvedValueOnce(succeededIntent({ status: 'requires_payment_method' }));
      const res = await payWithStripe();
      expect(res.status).toBe(402);
      expect(pool.getConnection).not.toHaveBeenCalled();
    });

    it('refuses a payment made by another account', async () => {
      mockStripe.paymentIntents.retrieve.mockResolvedValueOnce(succeededIntent({ metadata: { userId: '99' } }));
      const res = await payWithStripe();
      expect(res.status).toBe(403);
    });

    it('refuses to reuse a payment for a second order', async () => {
      mockStripe.paymentIntents.retrieve.mockResolvedValueOnce(succeededIntent());
      pool.query.mockResolvedValueOnce([[{ id: 12 }]]);
      const res = await payWithStripe();
      expect(res.status).toBe(409);
      expect(res.body.error).toContain('#12');
      expect(mockStripe.refunds.create).not.toHaveBeenCalled();
    });

    it('refunds when the amount paid does not match the cart', async () => {
      mockStripe.paymentIntents.retrieve.mockResolvedValueOnce(succeededIntent({ amount_received: 2999 }));
      pool.query.mockResolvedValueOnce([[]]);
      const connection = mockConnection(CART);

      const res = await payWithStripe();

      expect(res.status).toBe(409);
      expect(connection.rollback).toHaveBeenCalled();
      expect(mockStripe.refunds.create).toHaveBeenCalledWith({ payment_intent: 'pi_123' });
    });

    it('refunds when stock ran out during payment', async () => {
      mockStripe.paymentIntents.retrieve.mockResolvedValueOnce(succeededIntent());
      pool.query.mockResolvedValueOnce([[]]);
      mockConnection([{ ...CART[0], stock: 1 }]);

      const res = await payWithStripe();

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('refunded');
      expect(mockStripe.refunds.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('with PayPal configured', () => {
    const realFetch = global.fetch;

    beforeEach(() => {
      process.env.PAYPAL_CLIENT_ID = 'paypal-client';
      process.env.PAYPAL_CLIENT_SECRET = 'paypal-secret';
      global.fetch = jest.fn();
    });

    afterAll(() => {
      global.fetch = realFetch;
    });

    const reply = (body, ok = true) =>
      Promise.resolve({ ok, status: ok ? 200 : 422, json: () => Promise.resolve(body) });

    it('creates a PayPal order for the cart total', async () => {
      pool.query.mockResolvedValueOnce([[{ quantity: 2, price: '29.99', stock: 10, name: 'Keyboard' }]]);
      fetch.mockReturnValueOnce(reply({ access_token: 't' })).mockReturnValueOnce(reply({ id: 'ORDER123' }));

      const res = await request(app).post('/api/payments/paypal/order').set('Authorization', `Bearer ${token()}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: 'ORDER123', amount: 59.98 });
      const body = JSON.parse(fetch.mock.calls[1][1].body);
      expect(body.purchase_units[0]).toEqual({ custom_id: '7', amount: { currency_code: 'USD', value: '59.98' } });
    });

    it('captures an approved PayPal order and records it', async () => {
      pool.query
        .mockResolvedValueOnce([[{ quantity: 2, price: '29.99', stock: 10, name: 'Keyboard' }]]) // cart total
        .mockResolvedValueOnce([[]]); // reference unused
      fetch
        .mockReturnValueOnce(reply({ access_token: 't' }))
        .mockReturnValueOnce(
          reply({ status: 'APPROVED', purchase_units: [{ custom_id: '7', amount: { value: '59.98' } }] })
        )
        .mockReturnValueOnce(reply({ access_token: 't' }))
        .mockReturnValueOnce(
          reply({
            status: 'COMPLETED',
            payer: { email_address: 'sb-buyer@personal.example.com' },
            purchase_units: [
              { payments: { captures: [{ id: 'CAP1', status: 'COMPLETED', amount: { value: '59.98' } }] } }
            ]
          })
        );
      const connection = mockConnection(CART);

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token()}`)
        .send({ payment: { method: 'paypal', paypalOrderId: 'ORDER123' } });

      expect(res.status).toBe(201);
      expect(res.body.order.paymentDetails).toBe('PayPal (sb-buyer@personal.example.com)');
      const insert = connection.query.mock.calls.find((c) => c[0].includes('INSERT INTO orders'));
      expect(insert[1][5]).toBe('CAP1');
    });

    it('does not capture when the PayPal amount differs from the cart', async () => {
      pool.query.mockResolvedValueOnce([[{ quantity: 1, price: '29.99', stock: 10, name: 'Keyboard' }]]);
      fetch
        .mockReturnValueOnce(reply({ access_token: 't' }))
        .mockReturnValueOnce(
          reply({ status: 'APPROVED', purchase_units: [{ custom_id: '7', amount: { value: '59.98' } }] })
        );

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token()}`)
        .send({ payment: { method: 'paypal', paypalOrderId: 'ORDER123' } });

      expect(res.status).toBe(409);
      expect(fetch).toHaveBeenCalledTimes(2); // no capture call
    });
  });
});
