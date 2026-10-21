import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ProductVisual from './ProductVisual';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { formatPrice, stockStatus } from '../utils';

export default function ProductCard({ product }) {
  const { user } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const status = stockStatus(product.stock);

  async function handleAdd() {
    if (!user) {
      navigate('/login', { state: { from: `/products/${product.id}` } });
      return;
    }
    setBusy(true);
    try {
      await cart.add(product.id, 1);
      toast(`${product.name} added to cart`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="card product-card" data-testid="product-card">
      <Link to={`/products/${product.id}`} className="product-card-link">
        <ProductVisual product={product} />
        <div className="product-card-body">
          <h3 className="product-card-title">{product.name}</h3>
          <p className="product-card-desc">{product.description}</p>
        </div>
      </Link>
      <div className="product-card-footer">
        <div>
          <div className="price">{formatPrice(product.price)}</div>
          <span className={`badge badge-${status.tone}`}>{status.label}</span>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleAdd}
          disabled={busy || product.stock <= 0}
          aria-label={`Add ${product.name} to cart`}
        >
          {busy ? 'Adding…' : 'Add'}
        </button>
      </div>
    </article>
  );
}
