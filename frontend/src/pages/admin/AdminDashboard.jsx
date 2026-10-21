import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import ProductVisual from '../../components/ProductVisual';
import { useToast } from '../../context/ToastContext';
import { formatPrice, LOW_STOCK, stockStatus } from '../../utils';
import ProductForm from './ProductForm';

const FILTERS = {
  all: { label: 'All', test: () => true },
  low: { label: 'Low stock', test: (p) => p.stock > 0 && p.stock <= LOW_STOCK },
  out: { label: 'Out of stock', test: (p) => p.stock <= 0 },
};

export default function AdminDashboard() {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null); // null = closed, {} = new, product = edit

  const load = useCallback(async () => {
    try {
      setProducts(await api.getProducts());
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(
    () => ({
      count: products.length,
      units: products.reduce((s, p) => s + p.stock, 0),
      value: products.reduce((s, p) => s + p.stock * p.price, 0),
      low: products.filter((p) => p.stock <= LOW_STOCK).length,
    }),
    [products]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter(FILTERS[filter].test)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || String(p.id) === q);
  }, [products, query, filter]);

  async function handleSave(data) {
    if (editing?.id) {
      await api.updateProduct(editing.id, data);
      toast(`Updated "${data.name}"`);
    } else {
      await api.createProduct(data);
      toast(`Created "${data.name}"`);
    }
    setEditing(null);
    await load();
  }

  async function handleDelete(product) {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    try {
      await api.deleteProduct(product.id);
      toast(`Deleted "${product.name}"`);
      await load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const closeForm = useCallback(() => setEditing(null), []);

  return (
    <div className="container page">
      <div className="toolbar">
        <div>
          <h1 className="page-title">Inventory dashboard</h1>
          <p className="muted">Manage the product catalog and keep an eye on stock levels.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({})}>
          + New product
        </button>
      </div>

      <div className="stats">
        <div className="card stat">
          <span className="stat-label">Products</span>
          <strong className="stat-value" data-testid="stat-products">
            {stats.count}
          </strong>
        </div>
        <div className="card stat">
          <span className="stat-label">Units in stock</span>
          <strong className="stat-value">{stats.units.toLocaleString()}</strong>
        </div>
        <div className="card stat">
          <span className="stat-label">Inventory value</span>
          <strong className="stat-value">{formatPrice(stats.value)}</strong>
        </div>
        <div className={`card stat ${stats.low > 0 ? 'stat-warn' : ''}`}>
          <span className="stat-label">Low / out of stock</span>
          <strong className="stat-value">{stats.low}</strong>
        </div>
      </div>

      <div className="card table-card">
        <div className="table-toolbar">
          <input
            type="search"
            className="input"
            placeholder="Filter by name or ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Filter inventory"
          />
          <div className="segmented" role="group" aria-label="Stock filter">
            {Object.entries(FILTERS).map(([key, f]) => (
              <button
                key={key}
                className={filter === key ? 'active' : ''}
                onClick={() => setFilter(key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="table-scroll">
          <table className="table inventory-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="center muted">
                    Loading inventory…
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={5} className="center muted">
                    No products match.
                  </td>
                </tr>
              ) : (
                visible.map((p) => {
                  const status = stockStatus(p.stock);
                  return (
                    <tr key={p.id} data-testid="inventory-row">
                      <td>
                        <div className="inv-product">
                          <ProductVisual product={p} size="xs" />
                          <div>
                            <div className="inv-name">{p.name}</div>
                            <div className="muted small">#{p.id}</div>
                          </div>
                        </div>
                      </td>
                      <td>{formatPrice(p.price)}</td>
                      <td>
                        <div className="stock-cell">
                          <span>{p.stock}</span>
                          <div className="stock-bar">
                            <div
                              className={`stock-bar-fill tone-${status.tone}`}
                              style={{ width: `${Math.min(p.stock, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge badge-${status.tone}`}>{status.label}</span>
                      </td>
                      <td className="row-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditing(p)}>
                          Edit
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(p)}
                          aria-label={`Delete ${p.name}`}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <ProductForm product={editing.id ? editing : null} onSubmit={handleSave} onClose={closeForm} />
      )}
    </div>
  );
}
