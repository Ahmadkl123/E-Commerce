import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import ProductCard from '../components/ProductCard';

const SORTS = {
  featured: { label: 'Featured', fn: (a, b) => a.id - b.id },
  'price-asc': { label: 'Price: low to high', fn: (a, b) => a.price - b.price },
  'price-desc': { label: 'Price: high to low', fn: (a, b) => b.price - a.price },
  name: { label: 'Name A–Z', fn: (a, b) => a.name.localeCompare(b.name) },
};

export default function Home() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('featured');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search runs on the server (?search=) with a short debounce.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await api.getProducts(search);
        if (!cancelled) {
          setProducts(data);
          setError('');
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  const visible = useMemo(() => {
    const list = inStockOnly ? products.filter((p) => p.stock > 0) : [...products];
    return list.sort(SORTS[sort].fn);
  }, [products, sort, inStockOnly]);

  return (
    <>
      <section className="hero">
        <div className="hero-glow" />
        <div className="container hero-inner">
          <span className="eyebrow">New season · Free shipping</span>
          <h1>
            Gear that keeps up <br />
            with <span className="gradient-text">your ideas.</span>
          </h1>
          <p className="hero-sub">
            Headphones, keyboards, monitors and more, hand-picked for creators, gamers and builders.
          </p>
          <div className="hero-actions">
            <a href="#catalog" className="btn btn-primary btn-lg">
              Shop now
            </a>
            <a href="#catalog" className="btn btn-ghost btn-lg">
              Browse catalog
            </a>
          </div>
          <div className="hero-stats">
            <div>
              <strong>{products.length || '—'}</strong>
              <span>Products</span>
            </div>
            <div>
              <strong>24h</strong>
              <span>Dispatch</span>
            </div>
            <div>
              <strong>30-day</strong>
              <span>Returns</span>
            </div>
          </div>
        </div>
      </section>

      <section id="catalog" className="container page">
        <div className="toolbar">
          <h2 className="section-title">Catalog</h2>
          <div className="toolbar-controls">
            <input
              type="search"
              className="input"
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search products"
            />
            <select
              className="input"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort products"
            >
              {Object.entries(SORTS).map(([key, s]) => (
                <option key={key} value={key}>
                  {s.label}
                </option>
              ))}
            </select>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
              />
              In stock only
            </label>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading && products.length === 0 ? (
          <div className="grid">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="card skeleton" />
            ))}
          </div>
        ) : visible.length === 0 && !error ? (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <h3>No products found</h3>
            <p className="muted">Try a different search term.</p>
          </div>
        ) : (
          <div className={`grid ${loading ? 'is-loading' : ''}`}>
            {visible.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
