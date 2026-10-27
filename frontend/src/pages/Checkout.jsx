import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { productImage } from '../catalog';
import { CardIcon, LockIcon } from '../components/Icons';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { formatPrice } from '../utils';

// Payments are simulated: nothing is sent to a real card network or wallet.
// Only the method and a safe summary (brand + last 4 digits, or PayPal email)
// reach the backend, which records them on the order.

const METHODS = [
  { id: 'card', label: 'Credit or debit card', hint: 'Visa, Mastercard, Amex, Discover' },
  { id: 'paypal', label: 'PayPal', hint: 'Pay with your PayPal balance or linked card' },
  { id: 'apple_pay', label: 'Apple Pay', hint: 'Pay with Face ID or Touch ID' },
  { id: 'google_pay', label: 'Google Pay', hint: 'Pay with a card saved to Google' },
];

const PROCESSING_MS = 900;

function cardBrand(digits) {
  if (/^4/.test(digits)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'American Express';
  if (/^6(011|5)/.test(digits)) return 'Discover';
  return 'Card';
}

function luhnValid(digits) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

function formatCardNumber(value) {
  const digits = value.replace(/\D/g, '').slice(0, 19);
  if (cardBrand(digits) === 'American Express') {
    return [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 15)].filter(Boolean).join(' ');
  }
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

function formatExpiry(value) {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)} / ${digits.slice(2)}` : digits;
}

function validateCard(card) {
  const digits = card.number.replace(/\D/g, '');
  const brand = cardBrand(digits);
  if (digits.length < 13 || !luhnValid(digits)) return 'Please enter a valid card number.';
  if (!card.name.trim()) return 'Please enter the name on the card.';

  const [mm, yy] = card.expiry.split('/').map((p) => Number(p.trim()));
  if (!mm || mm < 1 || mm > 12 || Number.isNaN(yy)) return 'Please enter the expiry date as MM / YY.';
  const now = new Date();
  const expiresAt = new Date(2000 + yy, mm, 1); // first day after the expiry month
  if (expiresAt <= now) return 'This card has expired.';

  const cvcLength = brand === 'American Express' ? 4 : 3;
  if (!new RegExp(`^\\d{${cvcLength}}$`).test(card.cvc)) {
    return `Please enter the ${cvcLength}-digit security code.`;
  }
  return null;
}

export default function Checkout() {
  const cart = useCart();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [method, setMethod] = useState('card');
  const [card, setCard] = useState({ number: '', name: '', expiry: '', cvc: '' });
  const [paypalEmail, setPaypalEmail] = useState(user?.email ?? '');
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);

  const setCardField = (key, format = (v) => v) => (e) =>
    setCard((c) => ({ ...c, [key]: format(e.target.value) }));

  const digits = card.number.replace(/\D/g, '');
  const brand = cardBrand(digits);

  function buildPayment() {
    if (method === 'card') {
      const problem = validateCard(card);
      if (problem) throw new Error(problem);
      return { method, cardBrand: brand, cardLast4: digits.slice(-4) };
    }
    if (method === 'paypal') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paypalEmail.trim())) {
        throw new Error('Please enter the email of your PayPal account.');
      }
      return { method, email: paypalEmail.trim() };
    }
    return { method };
  }

  async function handlePay(e) {
    e.preventDefault();
    setError('');
    let payment;
    try {
      payment = buildPayment();
    } catch (err) {
      setError(err.message);
      return;
    }

    setPaying(true);
    try {
      await new Promise((r) => setTimeout(r, PROCESSING_MS));
      const order = await cart.checkout(payment);
      toast(`Payment received. Order #${order.id} is confirmed.`);
      navigate('/account');
    } catch (err) {
      setError(err.message);
      setPaying(false);
    }
  }

  if (cart.items.length === 0 && !paying) {
    return (
      <div className="container page">
        <div className="empty-state">
          <h1>Nothing to check out</h1>
          <p className="muted">Your cart is empty.</p>
          <Link to="/shop" className="btn btn-dark">
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  const selected = METHODS.find((m) => m.id === method);
  const payLabel = paying
    ? 'Processing payment…'
    : method === 'card'
      ? `Pay ${formatPrice(cart.total)}`
      : `Pay ${formatPrice(cart.total)} with ${selected.label}`;

  return (
    <div className="container page">
      <div className="cart-head">
        <h1 className="page-title">Checkout</h1>
        <Link to="/cart" className="link-underline">
          Back to cart
        </Link>
      </div>

      <div className="cart-layout">
        <form className="checkout-form" onSubmit={handlePay} noValidate>
          <h2 className="checkout-section-title">Payment method</h2>

          <div className="checkout-notice" role="note">
            Demo checkout: no real money is charged. Try the test card 4242 4242 4242 4242 with any
            future date and any CVC.
          </div>

          <div className="pay-methods" role="radiogroup" aria-label="Payment method">
            {METHODS.map((m) => (
              <label key={m.id} className={`pay-method${method === m.id ? ' is-selected' : ''}`}>
                <input
                  type="radio"
                  name="payment-method"
                  value={m.id}
                  checked={method === m.id}
                  onChange={() => {
                    setMethod(m.id);
                    setError('');
                  }}
                  disabled={paying}
                />
                <span className={`pay-mark pay-mark-${m.id}`} aria-hidden="true">
                  {m.id === 'card' ? <CardIcon size={18} /> : m.id === 'paypal' ? 'PayPal' : m.id === 'apple_pay' ? 'Pay' : 'G Pay'}
                </span>
                <span className="pay-method-text">
                  <strong>{m.label}</strong>
                  <small className="muted">{m.hint}</small>
                </span>
              </label>
            ))}
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          {method === 'card' && (
            <fieldset className="pay-panel" disabled={paying}>
              <legend className="visually-hidden">Card details</legend>
              <label className="field">
                <span>Card number</span>
                <div className="input-with-tag">
                  <input
                    className="input"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    placeholder="1234 5678 9012 3456"
                    value={card.number}
                    onChange={setCardField('number', formatCardNumber)}
                  />
                  {digits.length > 0 && <span className="input-tag">{brand}</span>}
                </div>
              </label>
              <label className="field">
                <span>Name on card</span>
                <input
                  className="input"
                  autoComplete="cc-name"
                  value={card.name}
                  onChange={setCardField('name')}
                />
              </label>
              <div className="field-row">
                <label className="field">
                  <span>Expiry date</span>
                  <input
                    className="input"
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    placeholder="MM / YY"
                    value={card.expiry}
                    onChange={setCardField('expiry', formatExpiry)}
                  />
                </label>
                <label className="field">
                  <span>Security code</span>
                  <input
                    className="input"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    placeholder={brand === 'American Express' ? '4 digits' : '3 digits'}
                    value={card.cvc}
                    onChange={setCardField('cvc', (v) => v.replace(/\D/g, '').slice(0, 4))}
                  />
                </label>
              </div>
            </fieldset>
          )}

          {method === 'paypal' && (
            <fieldset className="pay-panel" disabled={paying}>
              <legend className="visually-hidden">PayPal account</legend>
              <label className="field">
                <span>PayPal email</span>
                <input
                  className="input"
                  type="email"
                  autoComplete="email"
                  value={paypalEmail}
                  onChange={(e) => setPaypalEmail(e.target.value)}
                />
              </label>
              <p className="muted small">You will confirm the payment with PayPal.</p>
            </fieldset>
          )}

          {(method === 'apple_pay' || method === 'google_pay') && (
            <p className="pay-panel muted small">
              You will confirm the payment in {selected.label} on your device.
            </p>
          )}

          <button className={`btn btn-block pay-button pay-button-${method}`} disabled={paying}>
            <LockIcon size={16} />
            {payLabel}
          </button>
          <p className="muted small summary-note">
            Your card number is never stored. We only keep the card type and last four digits.
          </p>
        </form>

        <aside className="order-summary">
          <h2>Order summary</h2>
          <ul className="checkout-lines">
            {cart.items.map((item) => (
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
            <span>{formatPrice(cart.total)}</span>
          </div>
          <div className="summary-row">
            <span>Shipping</span>
            <span>Free</span>
          </div>
          <div className="summary-row summary-total">
            <span>Total</span>
            <span data-testid="checkout-total">{formatPrice(cart.total)}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
