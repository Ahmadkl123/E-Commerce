const payments = require('../services/payments');

function handle(fn) {
  return async (req, res, next) => {
    try {
      return res.status(200).json(await fn(req));
    } catch (error) {
      if (error instanceof payments.PaymentError) {
        return res.status(error.status).json({ error: error.message });
      }
      // Errors from the Stripe SDK carry a safe, readable message.
      if (error?.type && String(error.type).startsWith('Stripe')) {
        return res.status(502).json({ error: `Payment provider error: ${error.message}` });
      }
      return next(error);
    }
  };
}

/** GET /api/payments/config — which providers are enabled + public keys. */
const getConfig = handle(async () => payments.publicConfig());

/** POST /api/payments/stripe/intent — starts a card / wallet payment for the cart. */
const createStripeIntent = handle(async (req) => payments.createStripeIntent(req.user.id));

/** POST /api/payments/paypal/order — starts a PayPal payment for the cart. */
const createPaypalOrder = handle(async (req) => payments.createPaypalOrder(req.user.id));

module.exports = { getConfig, createStripeIntent, createPaypalOrder };
