import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import { categoryLabel, productCategory, productImage } from '../../catalog';
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
      toast(`Saved changes to ${data.name}`);
    } else {
      await api.createProduct(data);
      toast(`${data.name} was added to the catalog`);
    }
    setEditing(null);
    await load();
  }

  async function handleDelete(product) {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    try {
      await api.deleteProduct(product.id);
      toast(`${product.name} was deleted`);
      await load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const closeForm = useCallback(() => setEditing(null), []);

  return (
    <div className="admin">
      <div className="container">
        <div className="admin-head">
          <div>
            <p className="eyebrow">Admin</p>
            <h1 className="page-title">Products</h1>
          </div>
          <button className="btn btn-dark" onClick={() => setEditing({})}>
            Add product
          </button>
        </div>

        <div className="admin-stats">
          <div className="admin-stat">
            <span>Products</span>
            <strong data-testid="stat-products">{stats.count}</strong>
          </div>
          <div className="admin-stat">
            <span>Units in stock</span>
            <strong>{stats.units.toLocaleString()}</strong>
          </div>
          <div className="admin-stat">
            <span>Inventory value</span>
            <strong>{formatPrice(stats.value)}</strong>
          </div>
          <div className="admin-stat">
            <span>Low or out of stock</span>
            <strong className={stats.low > 0 ? 'text-warn' : ''}>{stats.low}</strong>
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-toolbar">
            <div className="tabs" role="group" aria-label="Stock filter">
              {Object.entries(FILTERS).map(([key, f]) => (
                <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>
                  {f.label}
                </button>
              ))}
            </div>
            <input
              type="search"
              className="input input-sm"
              placeholder="Search by name or ID"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Filter inventory"
            />
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="table-wrap">
            <table className="table inventory-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th className="num">Inventory</th>
                  <th className="num">Price</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="center muted">
                      Loading products…
                    </td>
                  </tr>
                ) : visible.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="center muted">
                      No products match your filters.
                    </td>
                  </tr>
                ) : (
                  visible.map((p) => {
                    const status = stockStatus(p.stock);
                    return (
                      <tr key={p.id} data-testid="inventory-row">
                        <td>
                          <div className="inv-product">
                            <img src={productImage(p)} alt="" />
                            <div>
                              <div className="inv-name">{p.name}</div>
                              <div className="muted small">ID {p.id}</div>
                            </div>
                          </div>
                        </td>
                        <td>{categoryLabel(productCategory(p))}</td>
                        <td>
                          <span className={`pill pill-${status.tone}`}>{status.label}</span>
                        </td>
                        <td className="num">{p.stock} in stock</td>
                        <td className="num">{formatPrice(p.price)}</td>
                        <td className="row-actions">
                          <button className="text-button" onClick={() => setEditing(p)}>
                            Edit
                          </button>
                          <button
                            className="text-button text-danger"
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
      </div>

      {editing && (
        <ProductForm product={editing.id ? editing : null} onSubmit={handleSave} onClose={closeForm} />
      )}
    </div>
  );
}
