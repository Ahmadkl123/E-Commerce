import { useEffect, useRef, useState } from 'react';
import { CloseIcon } from '../../components/Icons';

const EMPTY = { name: '', description: '', price: '', stock: '', image_url: '' };

export default function ProductForm({ product, onSubmit, onClose }) {
  const [form, setForm] = useState(() =>
    product
      ? {
          name: product.name,
          description: product.description ?? '',
          price: String(product.price),
          stock: String(product.stock),
          image_url: product.image_url ?? product.imageUrl ?? '',
        }
      : EMPTY
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const firstField = useRef(null);

  useEffect(() => {
    firstField.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const price = Number(form.price);
    const stock = Number(form.stock);
    if (!form.name.trim()) return setError('Product name is required.');
    if (!(price > 0)) return setError('Price must be a positive number.');
    if (!Number.isInteger(stock) || stock < 0) return setError('Stock must be a whole number ≥ 0.');

    setBusy(true);
    try {
      await onSubmit({
        name: form.name.trim(),
        description: form.description.trim(),
        price,
        stock,
        image_url: form.image_url.trim(),
      });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="modal"
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-form-title"
        noValidate
      >
        <div className="modal-head">
          <h2 id="product-form-title">{product ? 'Edit product' : 'Add product'}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <label className="field">
          <span>Name</span>
          <input ref={firstField} className="input" value={form.name} onChange={set('name')} />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea
            className="input"
            rows={3}
            value={form.description}
            onChange={set('description')}
          />
        </label>
        <label className="field">
          <span>Image URL or Path</span>
          <input
            className="input"
            type="text"
            placeholder="e.g. /images/products/headphones.jpg or https://..."
            value={form.image_url}
            onChange={set('image_url')}
          />
          <small style={{ color: 'var(--muted)', marginTop: 4 }}>
            Saved in the database. Supports local path (/images/products/...) or web image URL.
          </small>
        </label>
        {form.image_url.trim() && (
          <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
            <img
              src={form.image_url.trim()}
              alt="Preview"
              style={{
                width: 56,
                height: 56,
                objectFit: 'cover',
                borderRadius: 6,
                border: '1px solid var(--border)',
              }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Image preview</span>
          </div>
        )}
        <div className="field-row">
          <label className="field">
            <span>Price (USD)</span>
            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              value={form.price}
              onChange={set('price')}
            />
          </label>
          <label className="field">
            <span>Stock</span>
            <input
              className="input"
              type="number"
              step="1"
              min="0"
              value={form.stock}
              onChange={set('stock')}
            />
          </label>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-dark" disabled={busy}>
            {busy ? 'Saving…' : product ? 'Save changes' : 'Create product'}
          </button>
        </div>
      </form>
    </div>
  );
}
