// Real payment providers for checkout.
//
//  - Stripe: cards, Apple Pay, Google Pay, Link and other wallets through one
//    PaymentIntent. Needs STRIPE_SECRET_KEY + STRIPE_PUBLISHABLE_KEY.
//  - PayPal: PayPal Checkout (orders v2 REST API). Needs PAYPAL_CLIENT_ID +
//    PAYPAL_CLIENT_SECRET. PAYPAL_MODE=live switches from sandbox to live.
//
// Amounts are always computed on the server from the database, never taken
// from the browser. When no provider is configured the store falls back to
// the simulated "demo" checkout, which is refused once a real one is set up.

const pool = require('../db');

class PaymentError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const CURRENCY = 'usd';

function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY);
}

function paypalConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

function demoMode() {
  return !stripeConfigured() && !paypalConfigured();
}

function publicConfig() {
  return {
    currency: CURRENCY,
    demo: demoMode(),
    stripe: stripeConfigured() ? { publishableKey: process.env.STRIPE_PUBLISHABLE_KEY } : null,
    paypal: paypalConfigured() ? { clientId: process.env.PAYPAL_CLIENT_ID } : null
  };
}

const toCents = (amount) => Math.round(Number(amount) * 100);

/** Current cart total for a user, from database prices. */
async function getCartSummary(userId) {
  const [rows] = await pool.query(
    `SELECT ci.quantity, p.price, p.stock, p.name
     FROM cart_items ci JOIN products p ON ci.product_id = p.id
     WHERE ci.user_id = ?`,
    [userId]
  );
  if (rows.length === 0) throw new PaymentError('Your cart is empty.');
  for (const row of rows) {
    if (row.quantity > row.stock) {
      throw new PaymentError(
        `Insufficient stock for product '${row.name}'. Available: ${row.stock}, in cart: ${row.quantity}.`
      );
    }
  }
  const total = rows.reduce((sum, r) => sum + Number(r.price) * r.quantity, 0);
  return { total: Number(total.toFixed(2)), itemsCount: rows.length };
}

// ---------------------------------------------------------------- Stripe ----

let stripeClient = null;
function stripe() {
  if (!stripeConfigured()) throw new PaymentError('Card payments are not configured.', 503);
  if (!stripeClient) {
    const Stripe = require('stripe');
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

/** Creates a PaymentIntent for the user's current cart. */
async function createStripeIntent(userId) {
  const client = stripe();
  const { total } = await getCartSummary(userId);
  const intent = await client.paymentIntents.create({
    amount: toCents(total),
    currency: CURRENCY,
    automatic_payment_methods: { enabled: true },
    metadata: { userId: String(userId) }
  });
  return { clientSecret: intent.client_secret, amount: total };
}

function describeStripeCharge(charge) {
  const details = charge?.payment_method_details;
  if (!details) return 'Card';
  if (details.type === 'card' && details.card) {
    const brand = details.card.brand
      ? details.card.brand.charAt(0).toUpperCase() + details.card.brand.slice(1)
      : 'Card';
    const wallet = details.card.wallet?.type;
    const walletName = { apple_pay: 'Apple Pay', google_pay: 'Google Pay', link: 'Link' }[wallet];
    const card = `${brand} •••• ${details.card.last4}`;
    return walletName ? `${walletName} (${card})` : card;
  }
  return details.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

async function verifyStripe(paymentIntentId, userId) {
  if (typeof paymentIntentId !== 'string' || !/^pi_[A-Za-z0-9_]+$/.test(paymentIntentId)) {
    throw new PaymentError('Invalid payment reference.');
  }
  const intent = await stripe().paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] });
  if (intent.metadata?.userId !== String(userId)) {
    throw new PaymentError('This payment does not belong to your account.', 403);
  }
  if (intent.status !== 'succeeded') {
    throw new PaymentError('The payment has not been completed.', 402);
  }
  return {
    method: 'stripe',
    details: describeStripeCharge(intent.latest_charge),
    reference: intent.id,
    amountCents: intent.amount_received,
    refund: () => stripe().refunds.create({ payment_intent: intent.id })
  };
}

// ---------------------------------------------------------------- PayPal ----

function paypalBase() {
  return process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

async function paypalToken() {
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  if (!res.ok) throw new PaymentError('Could not connect to PayPal. Check the PayPal keys.', 502);
  return (await res.json()).access_token;
}

async function paypalRequest(path, { method = 'GET', body } = {}) {
  if (!paypalConfigured()) throw new PaymentError('PayPal is not configured.', 503);
  const token = await paypalToken();
  const res = await fetch(`${paypalBase()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const issue = data?.details?.[0]?.description || data?.message || 'PayPal request failed.';
    throw new PaymentError(issue, res.status === 422 ? 402 : 502);
  }
  return data;
}

/** Creates a PayPal order for the user's current cart. */
async function createPaypalOrder(userId) {
  if (!paypalConfigured()) throw new PaymentError('PayPal is not configured.', 503);
  const { total } = await getCartSummary(userId);
  const order = await paypalRequest('/v2/checkout/orders', {
    method: 'POST',
    body: {
      intent: 'CAPTURE',
      purchase_units: [
        {
          custom_id: String(userId),
          amount: { currency_code: CURRENCY.toUpperCase(), value: total.toFixed(2) }
        }
      ]
    }
  });
  return { id: order.id, amount: total };
}

/** Checks a buyer-approved PayPal order, then captures (charges) it. */
async function verifyPaypal(paypalOrderId, userId, expectedTotal) {
  if (typeof paypalOrderId !== 'string' || !/^[A-Z0-9]{5,40}$/.test(paypalOrderId)) {
    throw new PaymentError('Invalid PayPal order reference.');
  }
  const order = await paypalRequest(`/v2/checkout/orders/${paypalOrderId}`);
  const unit = order.purchase_units?.[0];
  if (unit?.custom_id !== String(userId)) {
    throw new PaymentError('This payment does not belong to your account.', 403);
  }
  if (toCents(unit.amount?.value) !== toCents(expectedTotal)) {
    throw new PaymentError('Your cart changed during payment. Please try again.', 409);
  }
  if (order.status !== 'APPROVED') {
    throw new PaymentError('The PayPal payment has not been approved.', 402);
  }

  const captured = await paypalRequest(`/v2/checkout/orders/${paypalOrderId}/capture`, { method: 'POST' });
  const capture = captured.purchase_units?.[0]?.payments?.captures?.[0];
  if (captured.status !== 'COMPLETED' || capture?.status !== 'COMPLETED') {
    throw new PaymentError('PayPal did not complete the payment.', 402);
  }
  const email = captured.payer?.email_address;
  return {
    method: 'paypal',
    details: email ? `PayPal (${email})` : 'PayPal',
    reference: capture.id,
    amountCents: toCents(capture.amount?.value),
    refund: () => paypalRequest(`/v2/payments/captures/${capture.id}/refund`, { method: 'POST', body: {} })
  };
}

// ------------------------------------------------------------------ Demo ----

const DEMO_METHODS = { card: 'Card', paypal: 'PayPal', apple_pay: 'Apple Pay', google_pay: 'Google Pay' };
const CARD_BRANDS = ['Visa', 'Mastercard', 'American Express', 'Discover', 'Card'];

function verifyDemo(payment) {
  if (!demoMode()) {
    throw new PaymentError('Demo payments are disabled because real payments are configured.');
  }
  const { method } = payment;
  if (method === 'card') {
    const brand = CARD_BRANDS.includes(payment.cardBrand) ? payment.cardBrand : 'Card';
    if (!/^\d{4}$/.test(String(payment.cardLast4 || ''))) {
      throw new PaymentError('Card payments must include the last 4 digits only.');
    }
    return { method, details: `${brand} •••• ${payment.cardLast4}`, reference: null };
  }
  if (method === 'paypal') {
    const email = typeof payment.email === 'string' ? payment.email.trim() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
      throw new PaymentError('A valid PayPal email is required.');
    }
    return { method, details: `PayPal (${email})`, reference: null };
  }
  return { method, details: DEMO_METHODS[method], reference: null };
}

/**
 * Validates the `payment` sent with POST /api/orders and, for PayPal, charges it.
 * Returns null when no payment was sent, otherwise
 * { method, details, reference, amountCents?, refund? }.
 */
async function verifyPayment(payment, userId) {
  if (payment === undefined || payment === null) {
    if (!demoMode()) throw new PaymentError('Payment is required to place an order.', 402);
    return null;
  }
  if (typeof payment !== 'object') throw new PaymentError('Invalid payment information.');

  if (payment.method === 'stripe') return verifyStripe(payment.paymentIntentId, userId);
  if (payment.method === 'paypal' && payment.paypalOrderId !== undefined) {
    const { total } = await getCartSummary(userId);
    return verifyPaypal(payment.paypalOrderId, userId, total);
  }
  if (Object.prototype.hasOwnProperty.call(DEMO_METHODS, payment.method)) return verifyDemo(payment);
  throw new PaymentError('Unsupported payment method.');
}

module.exports = {
  PaymentError,
  publicConfig,
  createStripeIntent,
  createPaypalOrder,
  verifyPayment,
  toCents
};
