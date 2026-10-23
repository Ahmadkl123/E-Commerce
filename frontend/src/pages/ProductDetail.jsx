import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { categoryLabel, productCategory, productImage } from '../catalog';
import { ReturnIcon, ShieldIcon, TruckIcon } from '../components/Icons';
import ProductCard from '../components/ProductCard';
import QuantityStepper from '../components/QuantityStepper';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { formatPrice, FREE_SHIPPING_THRESHOLD, stockStatus } from '../utils';

export default function ProductDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [error, setError] = useState('');
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setProduct(null);
    setError('');
    setQty(1);
    window.scrollTo(0, 0);
    api.getProduct(id).then(
      (p) => {
        setProduct(p);
        api
          .getProducts()
          .then((all) => {
            const others = all.filter((x) => x.id !== p.id && x.stock > 0);
            const same = others.filter((x) => productCategory(x) === productCategory(p));
            setRelated([...same, ...others.filter((x) => !same.includes(x))].slice(0, 4));
          })
          .catch(() => setRelated([]));
      },
      (err) => setError(err.message)
    );
  }, [id]);

  async function handleAdd() {
    if (!user) {
      navigate('/login', { state: { from: `/products/${id}` } });
      return;
    }
    setBusy(true);
    try {
      await cart.add(product.id, qty);
      toast(`Added ${qty} × ${product.name} to your cart`);
      setQty(1);
      cart.openDrawer();
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
          <h1>{error}</h1>
          <p className="muted">This product may have been removed from the catalog.</p>
          <Link to="/shop" className="btn btn-dark">
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container page">
        <div className="pdp">
          <div className="skeleton pdp-skeleton" />
          <div>
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line short" />
          </div>
        </div>
      </div>
    );
  }

  const status = stockStatus(product.stock);
  const category = productCategory(product);
  const inCart = cart.items.find((i) => i.productId === product.id)?.quantity ?? 0;
  const maxQty = Math.max(product.stock - inCart, 0);

  return (
    <div className="container page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <Link to={`/shop?category=${category}`}>{categoryLabel(category)}</Link>
        <span>/</span>
        <span aria-current="page">{product.name}</span>
      </nav>

      <div className="pdp">
        <div className="pdp-media">
          <img src={productImage(product)} alt={product.name} />
        </div>

        <div className="pdp-info">
          <p className="eyebrow">{categoryLabel(category)}</p>
          <h1>{product.name}</h1>
          <p className="pdp-price">{formatPrice(product.price)}</p>
          <p className="muted small">Tax included. Free shipping on orders over ${FREE_SHIPPING_THRESHOLD}.</p>

          <p className={`stock-line stock-${status.tone}`}>
            <span className="stock-dot" />
            {status.label}
          </p>

          <div className="pdp-buy">
            <QuantityStepper value={qty} max={maxQty} onChange={setQty} disabled={maxQty === 0 || busy} />
            <button className="btn btn-dark btn-grow" onClick={handleAdd} disabled={maxQty === 0 || busy}>
              {product.stock <= 0 ? 'Sold out' : busy ? 'Adding…' : 'Add to cart'}
            </button>
          </div>
          {inCart > 0 && (
            <p className="muted small">
              {inCart} already in your cart
              {maxQty === 0 && ', which is all we have in stock'}.
            </p>
          )}

          <div className="pdp-perks">
            <div>
              <TruckIcon />
              <span>Free delivery over ${FREE_SHIPPING_THRESHOLD}, dispatched within 24 hours</span>
            </div>
            <div>
              <ReturnIcon />
              <span>Free returns within 30 days</span>
            </div>
            <div>
              <ShieldIcon />
              <span>2-year manufacturer warranty</span>
            </div>
          </div>

          <div className="accordion">
            <details open>
              <summary>Description</summary>
              <p>{product.description || 'No description available.'}</p>
            </details>
            <details>
              <summary>Shipping &amp; returns</summary>
              <p>
                Orders placed before 2pm on a weekday ship the same day. Standard delivery takes 2–4 business
                days and is free on orders over ${FREE_SHIPPING_THRESHOLD}. Unused items can be returned
                within 30 days for a full refund.
              </p>
            </details>
            <details>
              <summary>Warranty</summary>
              <p>
                Covered by a two-year warranty against manufacturing defects. Contact us with your order
                number and we'll arrange a repair or replacement.
              </p>
            </details>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>You may also like</h2>
          </div>
          <div className="product-grid">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
