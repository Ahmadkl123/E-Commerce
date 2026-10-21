import { useEffect, useRef, useState } from 'react';

const EMPTY = { name: '', description: '', price: '', stock: '' };

export default function ProductForm({ product, onSubmit, onClose }) {
  const [form, setForm] = useState(() =>
    product
      ? {
          name: product.name,
          description: product.description ?? '',
          price: String(product.price),
          stock: String(product.stock),
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
      await onSubmit({ name: form.name.trim(), description: form.description.trim(), price, stock });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="card modal"
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-form-title"
        noValidate
      >
        <div className="modal-head">
          <h2 id="product-form-title">{product ? 'Edit product' : 'New product'}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            ✕
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
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : product ? 'Save changes' : 'Create product'}
          </button>
        </div>
      </form>
    </div>
  );
}
