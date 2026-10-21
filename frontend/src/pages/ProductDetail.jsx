import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import ProductVisual from '../components/ProductVisual';
import QuantityStepper from '../components/QuantityStepper';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { formatPrice, stockStatus } from '../utils';

export default function ProductDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setProduct(null);
    setError('');
    setQty(1);
    api.getProduct(id).then(setProduct, (err) => setError(err.message));
  }, [id]);

  async function handleAdd() {
    if (!user) {
      navigate('/login', { state: { from: `/products/${id}` } });
      return;
    }
    setBusy(true);
    try {
      await cart.add(product.id, qty);
      toast(`Added ${qty} × ${product.name} to cart`);
      setQty(1);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="container page">
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <h2>{error}</h2>
          <Link to="/" className="btn btn-primary">
            Back to shop
          </Link>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container page">
        <div className="detail">
          <div className="card skeleton detail-skeleton" />
          <div className="card skeleton detail-skeleton" />
        </div>
      </div>
    );
  }

  const status = stockStatus(product.stock);
  const inCart = cart.items.find((i) => i.productId === product.id)?.quantity ?? 0;
  const maxQty = Math.max(product.stock - inCart, 0);

  return (
    <div className="container page">
      <Link to="/" className="back-link">
        ← Back to catalog
      </Link>
      <div className="detail">
        <ProductVisual product={product} size="lg" />
        <div className="detail-info">
          <span className={`badge badge-${status.tone}`}>{status.label}</span>
          <h1>{product.name}</h1>
          <div className="price price-lg">{formatPrice(product.price)}</div>
          <p className="detail-desc">{product.description}</p>

          <div className="detail-actions">
            <QuantityStepper
              value={qty}
              max={maxQty}
              onChange={setQty}
              disabled={maxQty === 0 || busy}
            />
            <button
              className="btn btn-primary btn-lg"
              onClick={handleAdd}
              disabled={maxQty === 0 || busy}
            >
              {busy ? 'Adding…' : 'Add to cart'}
            </button>
          </div>
          {inCart > 0 && <p className="muted small">You already have {inCart} in your cart.</p>}

          <ul className="perks">
            <li>🚚 Free shipping on every order</li>
            <li>↩️ 30-day hassle-free returns</li>
            <li>🛡️ 2-year warranty included</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
