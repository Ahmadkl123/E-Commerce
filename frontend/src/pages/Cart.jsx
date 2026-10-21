import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ProductVisual from '../components/ProductVisual';
import QuantityStepper from '../components/QuantityStepper';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { formatPrice } from '../utils';

export default function Cart() {
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState(null);
  const [checkingOut, setCheckingOut] = useState(false);

  async function run(productId, action) {
    setBusyId(productId);
    try {
      await action();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleCheckout() {
    setCheckingOut(true);
    try {
      const order = await cart.checkout();
      toast(`Order #${order.id} placed successfully!`);
      navigate('/orders');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setCheckingOut(false);
    }
  }

  if (cart.items.length === 0) {
    return (
      <div className="container page">
        <div className="empty-state">
          <div className="empty-icon">🛒</div>
          <h2>Your cart is empty</h2>
          <p className="muted">Find something you love in the catalog.</p>
          <Link to="/" className="btn btn-primary">
            Start shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container page">
      <h1 className="page-title">Your cart</h1>
      <div className="cart-layout">
        <div className="cart-items">
          {cart.items.map((item) => (
            <div key={item.productId} className="card cart-item" data-testid="cart-item">
              <ProductVisual product={{ id: item.productId, name: item.name }} size="sm" />
              <div className="cart-item-info">
                <Link to={`/products/${item.productId}`} className="cart-item-name">
                  {item.name}
                </Link>
                <span className="muted small">{formatPrice(item.price)} each</span>
              </div>
              <QuantityStepper
                value={item.quantity}
                max={item.stock}
                disabled={busyId === item.productId}
                onChange={(q) => run(item.productId, () => cart.setQuantity(item.productId, q))}
              />
              <div className="cart-item-subtotal">{formatPrice(item.subtotal)}</div>
              <button
                className="icon-btn"
                aria-label={`Remove ${item.name}`}
                disabled={busyId === item.productId}
                onClick={() => run(item.productId, () => cart.remove(item.productId))}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <aside className="card summary">
          <h3>Order summary</h3>
          <div className="summary-row">
            <span>Items</span>
            <span>{cart.count}</span>
          </div>
          <div className="summary-row">
            <span>Subtotal</span>
            <span>{formatPrice(cart.total)}</span>
          </div>
          <div className="summary-row">
            <span>Shipping</span>
            <span className="text-success">Free</span>
          </div>
          <div className="summary-row summary-total">
            <span>Total</span>
            <span data-testid="cart-total">{formatPrice(cart.total)}</span>
          </div>
          <button
            className="btn btn-primary btn-lg btn-block"
            onClick={handleCheckout}
            disabled={checkingOut}
          >
            {checkingOut ? 'Placing order…' : 'Checkout'}
          </button>
          <p className="muted small center">Prices are confirmed by the server at checkout.</p>
        </aside>
      </div>
    </div>
  );
}
