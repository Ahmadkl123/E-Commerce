import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { productImage } from '../catalog';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { formatPrice, FREE_SHIPPING_THRESHOLD } from '../utils';
import { CloseIcon } from './Icons';
import QuantityStepper from './QuantityStepper';

export default function CartDrawer() {
  const cart = useCart();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!cart.drawerOpen) return;
    const onKey = (e) => e.key === 'Escape' && cart.closeDrawer();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [cart.drawerOpen, cart.closeDrawer]);

  if (!cart.drawerOpen) return null;

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

  function go(path) {
    cart.closeDrawer();
    navigate(path);
  }

  const remaining = FREE_SHIPPING_THRESHOLD - cart.total;

  return (
    <div className="drawer-backdrop" onClick={cart.closeDrawer}>
      <aside
        className="drawer drawer-right"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
      >
        <div className="drawer-head">
          <h2>Cart {cart.count > 0 && <span className="muted">({cart.count})</span>}</h2>
          <button className="header-icon" aria-label="Close cart" onClick={cart.closeDrawer}>
            <CloseIcon />
          </button>
        </div>

        {!user ? (
          <div className="drawer-empty">
            <p>Sign in to start adding items to your cart.</p>
            <button className="btn btn-dark" onClick={() => go('/login')}>
              Sign in
            </button>
          </div>
        ) : cart.items.length === 0 ? (
          <div className="drawer-empty">
            <p>Your cart is empty.</p>
            <button className="btn btn-dark" onClick={() => go('/shop')}>
              Continue shopping
            </button>
          </div>
        ) : (
          <>
            <div className="shipping-meter">
              {remaining > 0 ? (
                <p>
                  You're <strong>{formatPrice(remaining)}</strong> away from free shipping.
                </p>
              ) : (
                <p>Your order qualifies for free shipping.</p>
              )}
              <div className="meter">
                <div style={{ width: `${Math.min((cart.total / FREE_SHIPPING_THRESHOLD) * 100, 100)}%` }} />
              </div>
            </div>

            <ul className="drawer-lines">
              {cart.items.map((item) => (
                <li key={item.productId} className="line">
                  <Link to={`/products/${item.productId}`} onClick={cart.closeDrawer} className="line-image">
                    <img src={productImage(item)} alt={item.name} />
                  </Link>
                  <div className="line-info">
                    <Link to={`/products/${item.productId}`} onClick={cart.closeDrawer} className="line-name">
                      {item.name}
                    </Link>
                    <span className="muted">{formatPrice(item.price)}</span>
                    <div className="line-controls">
                      <QuantityStepper
                        value={item.quantity}
                        max={item.stock}
                        size="sm"
                        disabled={busyId === item.productId}
                        onChange={(q) => run(item.productId, () => cart.setQuantity(item.productId, q))}
                      />
                      <button
                        className="text-button"
                        disabled={busyId === item.productId}
                        onClick={() => run(item.productId, () => cart.remove(item.productId))}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <span className="line-total">{formatPrice(item.subtotal)}</span>
                </li>
              ))}
            </ul>

            <div className="drawer-foot">
              <div className="summary-row summary-total">
                <span>Subtotal</span>
                <span>{formatPrice(cart.total)}</span>
              </div>
              <p className="muted small">Taxes and shipping calculated at checkout.</p>
              <button className="btn btn-dark btn-block" onClick={() => go('/cart')}>
                View cart &amp; check out
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
