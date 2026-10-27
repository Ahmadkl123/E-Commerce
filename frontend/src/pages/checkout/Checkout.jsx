import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { productImage } from '../../catalog';
import { CardIcon } from '../../components/Icons';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { formatPrice } from '../../utils';
import DemoPayment from './DemoPayment';
import PayPalPayment from './PayPalPayment';
import StripePayment from './StripePayment';

// The backend decides which payment providers are live (GET /api/payments/config):
//  - Stripe  -> cards, Apple Pay, Google Pay (real, via Stripe's secure form)
//  - PayPal  -> PayPal Checkout (real)
//  - neither -> simulated demo checkout

function OrderSummary({ items, total }) {
  return (
    <aside className="order-summary">
      <h2>Order summary</h2>
      <ul className="checkout-lines">
        {items.map((item) => (
          <li key={item.productId}>
            <span className="checkout-thumb">
              <img src={productImage(item)} alt="" />
              <span className="checkout-qty">{item.quantity}</span>
            </span>
            <span className="checkout-name">{item.name}</span>
            <span>{formatPrice(item.subtotal)}</span>
          </li>
        ))}
      </ul>
      <div className="summary-row">
        <span>Subtotal</span>
        <span>{formatPrice(total)}</span>
      </div>
      <div className="summary-row">
        <span>Shipping</span>
        <span>Free</span>
      </div>
      <div className="summary-row summary-total">
        <span>Total</span>
        <span data-testid="checkout-total">{formatPrice(total)}</span>
      </div>
    </aside>
  );
}

function ProviderChoice({ config, value, onChange }) {
  const options = [
    config.stripe && {
      id: 'stripe',
      label: 'Card, Apple Pay or Google Pay',
      hint: 'Visa, Mastercard, Amex and more',
      mark: <CardIcon size={18} />,
    },
    config.paypal && { id: 'paypal', label: 'PayPal', hint: 'Log in to PayPal to pay', mark: 'PayPal' },
  ].filter(Boolean);

  if (options.length < 2) return null;

  return (
    <div className="pay-methods" role="radiogroup" aria-label="Payment method">
      {options.map((o) => (
        <label key={o.id} className={`pay-method${value === o.id ? ' is-selected' : ''}`}>
          <input
            type="radio"
            name="payment-provider"
            value={o.id}
            checked={value === o.id}
            onChange={() => onChange(o.id)}
          />
          <span className={`pay-mark pay-mark-${o.id}`} aria-hidden="true">
            {o.mark}
          </span>
          <span className="pay-method-text">
            <strong>{o.label}</strong>
            <small className="muted">{o.hint}</small>
          </span>
        </label>
      ))}
    </div>
  );
}

export default function Checkout() {
  const cart = useCart();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState('');
  const [provider, setProvider] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [returnError, setReturnError] = useState('');
  const handledReturn = useRef(false);

  useEffect(() => {
    api.getPaymentConfig().then(
      (c) => {
        setConfig(c);
        setProvider(c.stripe ? 'stripe' : c.paypal ? 'paypal' : null);
      },
      (err) => setConfigError(err.message)
    );
  }, []);

  // Turns a successful payment into an order.
  const placeOrder = useCallback(
    async (payment) => {
      const order = await cart.checkout(payment);
      toast(`Payment received. Order #${order.id} is confirmed.`);
      navigate('/account');
    },
    [cart, toast, navigate]
  );

  // Some Stripe payment methods redirect away and come back here with the result.
  useEffect(() => {
    const intentId = params.get('payment_intent');
    if (!intentId || handledReturn.current) return;
    handledReturn.current = true;
    const status = params.get('redirect_status');
    setParams({}, { replace: true });
    if (status === 'succeeded') {
      setCompleting(true);
      placeOrder({ method: 'stripe', paymentIntentId: intentId }).catch((err) => {
        setCompleting(false);
        setReturnError(err.message);
      });
    } else {
      setReturnError('The payment was not completed. You have not been charged.');
    }
  }, [params, setParams, placeOrder]);

  if (completing) {
    return (
      <div className="container page">
        <div className="empty-state">
          <h1>Confirming your order…</h1>
          <p className="muted">Please don&apos;t close this page.</p>
        </div>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="container page">
        <div className="empty-state">
          <h1>Nothing to check out</h1>
          {returnError && <div className="alert alert-error">{returnError}</div>}
          <p className="muted">Your cart is empty.</p>
          <Link to="/shop" className="btn btn-dark">
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container page">
      <div className="cart-head">
        <h1 className="page-title">Checkout</h1>
        <Link to="/cart" className="link-underline">
          Back to cart
        </Link>
      </div>

      <div className="cart-layout">
        <div className="checkout-form">
          <h2 className="checkout-section-title">Payment method</h2>
          {returnError && <div className="alert alert-error">{returnError}</div>}
          {configError && <div className="alert alert-error">{configError}</div>}
          {!config && !configError && <div className="skeleton stripe-skeleton" aria-label="Loading payment options" />}

          {config?.demo && <DemoPayment total={cart.total} defaultEmail={user?.email} onPay={placeOrder} />}

          {config && !config.demo && (
            <>
              <ProviderChoice config={config} value={provider} onChange={setProvider} />
              {provider === 'stripe' && (
                <StripePayment publishableKey={config.stripe.publishableKey} total={cart.total} onPaid={placeOrder} />
              )}
              {provider === 'paypal' && (
                <PayPalPayment clientId={config.paypal.clientId} total={cart.total} onPaid={placeOrder} />
              )}
            </>
          )}
        </div>

        <OrderSummary items={cart.items} total={cart.total} />
      </div>
    </div>
  );
}
