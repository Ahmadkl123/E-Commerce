import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { productImage } from '../catalog';
import QuantityStepper from '../components/QuantityStepper';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { formatPrice, FREE_SHIPPING_THRESHOLD } from '../utils';

export default function Cart() {
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState(null);

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


  if (cart.items.length === 0) {
    return (
      <div className="container page">
        <div className="empty-state">
          <h1>Your cart is empty</h1>
          <p className="muted">Looks like you haven't added anything yet.</p>
          <Link to="/shop" className="btn btn-dark">
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  const shippingFree = cart.total >= FREE_SHIPPING_THRESHOLD;

  return (
    <div className="container page">
      <div className="cart-head">
        <h1 className="page-title">Your cart</h1>
        <Link to="/shop" className="link-underline">
          Continue shopping
        </Link>
      </div>

      <div className="cart-layout">
        <div>
          <div className="cart-table-head">
            <span>Product</span>
            <span>Quantity</span>
            <span>Total</span>
          </div>
          {cart.items.map((item) => (
            <div key={item.productId} className="cart-row" data-testid="cart-item">
              <div className="cart-product">
                <Link to={`/products/${item.productId}`} className="cart-thumb">
                  <img src={productImage(item)} alt={item.name} />
                </Link>
                <div>
                  <Link to={`/products/${item.productId}`} className="cart-name">
                    {item.name}
                  </Link>
                  <span className="muted small">{formatPrice(item.price)}</span>
                </div>
              </div>
              <div className="cart-qty">
                <QuantityStepper
                  value={item.quantity}
                  max={item.stock}
                  size="sm"
                  disabled={busyId === item.productId}
                  onChange={(q) => run(item.productId, () => cart.setQuantity(item.productId, q))}
                />
                <button
                  className="text-button"
                  aria-label={`Remove ${item.name}`}
                  disabled={busyId === item.productId}
                  onClick={() => run(item.productId, () => cart.remove(item.productId))}
                >
                  Remove
                </button>
              </div>
              <div className="cart-line-total">{formatPrice(item.subtotal)}</div>
            </div>
          ))}
        </div>

        <aside className="order-summary">
          <h2>Order summary</h2>
          <div className="summary-row">
            <span>Subtotal</span>
            <span>{formatPrice(cart.total)}</span>
          </div>
          <div className="summary-row">
            <span>Shipping</span>
            <span>{shippingFree ? 'Free' : 'Calculated at checkout'}</span>
          </div>
          <div className="summary-row summary-total">
            <span>Total</span>
            <span data-testid="cart-total">{formatPrice(cart.total)}</span>
          </div>
          <button className="btn btn-dark btn-block" onClick={() => navigate('/checkout')}>
            Checkout
          </button>
          <p className="muted small summary-note">
            Final prices are confirmed at checkout. By placing your order you agree to our terms of sale.
          </p>
        </aside>
      </div>
    </div>
  );
}
