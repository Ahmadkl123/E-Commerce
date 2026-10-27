import { useEffect, useRef, useState } from 'react';
import { CloseIcon, ImageIcon } from '../../components/Icons';
import { ACCEPT_ATTR, fileToImageData } from '../../imageUpload';

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
  const [processing, setProcessing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [showUrl, setShowUrl] = useState(() => /^(https?:)?\//i.test(form.image_url));
  const [previewBroken, setPreviewBroken] = useState(false);
  const firstField = useRef(null);
  const fileInput = useRef(null);

  useEffect(() => {
    firstField.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const setImage = (value) => {
    setPreviewBroken(false);
    setForm((f) => ({ ...f, image_url: value }));
  };

  async function handleFile(file) {
    if (!file) return;
    setError('');
    setProcessing(true);
    try {
      setImage(await fileToImageData(file));
      setShowUrl(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  const image = form.image_url.trim();
  const isUpload = image.startsWith('data:');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const price = Number(form.price);
    const stock = Number(form.stock);
    if (!form.name.trim()) return setError('Product name is required.');
    if (!(price > 0)) return setError('Price must be a positive number.');
    if (!Number.isInteger(stock) || stock < 0) return setError('Stock must be a whole number ≥ 0.');

    if (processing) return setError('Please wait for the photo to finish processing.');

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
        <div className="field">
          <span id="photo-label">Photo</span>
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT_ATTR}
            className="visually-hidden"
            aria-label="Upload product photo"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          {image && !previewBroken ? (
            <div className="photo-preview">
              <img src={image} alt="Product photo preview" onError={() => setPreviewBroken(true)} />
              <div className="photo-preview-info">
                <span>{isUpload ? 'Uploaded photo' : 'Image from link'}</span>
                <div className="photo-preview-actions">
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => fileInput.current?.click()}
                    disabled={processing}
                  >
                    Replace
                  </button>
                  <button type="button" className="text-button" onClick={() => setImage('')}>
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className={`photo-drop${dragging ? ' is-dragging' : ''}`}
              aria-describedby="photo-label"
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              disabled={processing}
            >
              <ImageIcon size={26} />
              <strong>{processing ? 'Processing photo…' : 'Upload a photo'}</strong>
              <small className="muted">
                {previewBroken ? 'That image link could not be loaded. ' : ''}
                Click or drag a picture here. JPEG, PNG, WebP or GIF, up to 10 MB.
              </small>
            </button>
          )}
          {showUrl ? (
            <input
              className="input photo-url"
              type="text"
              aria-label="Image URL"
              placeholder="https://… or /images/products/…"
              value={isUpload ? '' : form.image_url}
              onChange={(e) => setImage(e.target.value)}
            />
          ) : (
            <button type="button" className="text-button photo-url-toggle" onClick={() => setShowUrl(true)}>
              Use an image link instead
            </button>
          )}
        </div>
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
          <button className="btn btn-dark" disabled={busy || processing}>
            {busy ? 'Saving…' : product ? 'Save changes' : 'Create product'}
          </button>
        </div>
      </form>
    </div>
  );
}
