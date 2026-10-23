import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { CATEGORIES, categoryLabel, productCategory } from '../catalog';
import ProductCard from '../components/ProductCard';

const SORTS = {
  featured: { label: 'Featured', fn: (a, b) => a.id - b.id },
  newest: { label: 'Newest', fn: (a, b) => b.id - a.id },
  'price-asc': { label: 'Price, low to high', fn: (a, b) => a.price - b.price },
  'price-desc': { label: 'Price, high to low', fn: (a, b) => b.price - a.price },
  name: { label: 'Alphabetical, A–Z', fn: (a, b) => a.name.localeCompare(b.name) },
};

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const category = params.get('category') || '';
  const query = params.get('q') || '';
  const sort = SORTS[params.get('sort')] ? params.get('sort') : 'featured';
  const inStockOnly = params.get('stock') === '1';

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search runs on the server (?search=); category, stock and sort are applied here.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getProducts(query)
      .then(
        (data) => !cancelled && (setProducts(data), setError('')),
        (err) => !cancelled && setError(err.message)
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [query]);

  function update(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  const counts = useMemo(() => {
    const c = {};
    for (const p of products) c[productCategory(p)] = (c[productCategory(p)] || 0) + 1;
    return c;
  }, [products]);

  const visible = useMemo(
    () =>
      products
        .filter((p) => !category || productCategory(p) === category)
        .filter((p) => !inStockOnly || p.stock > 0)
        .sort(SORTS[sort].fn),
    [products, category, inStockOnly, sort]
  );

  const title = query ? `Results for “${query}”` : categoryLabel(category);

  return (
    <div className="container page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        {category ? <Link to="/shop">Shop</Link> : <span aria-current="page">Shop</span>}
        {category && (
          <>
            <span>/</span>
            <span aria-current="page">{categoryLabel(category)}</span>
          </>
        )}
      </nav>

      <h1 className="page-title">{title}</h1>

      <div className="shop-layout">
        <aside className="filters" aria-label="Filters">
          <div className="filter-group">
            <h3>Category</h3>
            <ul>
              <li>
                <button className={!category ? 'active' : ''} onClick={() => update('category', '')}>
                  All products <span>{products.length}</span>
                </button>
              </li>
              {CATEGORIES.map((c) => (
                <li key={c.slug}>
                  <button
                    className={category === c.slug ? 'active' : ''}
                    onClick={() => update('category', c.slug)}
                  >
                    {c.label} <span>{counts[c.slug] || 0}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="filter-group">
            <h3>Availability</h3>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => update('stock', e.target.checked ? '1' : '')}
              />
              In stock only
            </label>
          </div>
        </aside>

        <div>
          <div className="shop-toolbar">
            <span className="muted">
              {visible.length} {visible.length === 1 ? 'product' : 'products'}
            </span>
            <label className="sort-select">
              <span>Sort by</span>
              <select value={sort} onChange={(e) => update('sort', e.target.value === 'featured' ? '' : e.target.value)}>
                {Object.entries(SORTS).map(([key, s]) => (
                  <option key={key} value={key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          {loading && products.length === 0 ? (
            <div className="product-grid product-grid-3">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="skeleton-card">
                  <div className="skeleton" />
                  <div className="skeleton skeleton-line" />
                  <div className="skeleton skeleton-line short" />
                </div>
              ))}
            </div>
          ) : visible.length === 0 && !error ? (
            <div className="empty-state">
              <h2>No products found</h2>
              <p className="muted">Try a different search or clear your filters.</p>
              <Link to="/shop" className="btn btn-dark">
                Clear filters
              </Link>
            </div>
          ) : (
            <div className={`product-grid product-grid-3 ${loading ? 'is-loading' : ''}`}>
              {visible.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
