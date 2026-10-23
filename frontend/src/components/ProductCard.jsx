import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { categoryLabel, productCategory, productImage } from '../catalog';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { formatPrice, LOW_STOCK } from '../utils';

export default function ProductCard({ product }) {
  const { user } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const soldOut = product.stock <= 0;

  async function handleAdd() {
    if (!user) {
      navigate('/login', { state: { from: `/products/${product.id}` } });
      return;
    }
    setBusy(true);
    try {
      await cart.add(product.id, 1);
      cart.openDrawer();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="product-card" data-testid="product-card">
      <div className="product-card-top">
        <Link to={`/products/${product.id}`} className="product-card-media">
          <img src={productImage(product)} alt={product.name} loading="lazy" />
          {soldOut && <span className="product-flag">Sold out</span>}
          {!soldOut && product.stock <= LOW_STOCK && <span className="product-flag">Low stock</span>}
        </Link>
        <button
          className="quick-add"
          onClick={handleAdd}
          disabled={busy || soldOut}
          aria-label={`Add ${product.name} to cart`}
        >
          {soldOut ? 'Sold out' : busy ? 'Adding…' : 'Add to cart'}
        </button>
      </div>
      <div className="product-card-info">
        <span className="product-card-category">{categoryLabel(productCategory(product))}</span>
        <Link to={`/products/${product.id}`} className="product-card-name">
          {product.name}
        </Link>
        <span className="product-card-price">{formatPrice(product.price)}</span>
      </div>
    </article>
  );
}
