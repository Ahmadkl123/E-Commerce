import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { formatDate, formatPrice } from '../utils';

export default function Orders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getOrders().then(setOrders, (err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="container page">
        <div className="alert alert-error">{error}</div>
      </div>
    );
  }

  if (!orders) {
    return (
      <div className="container page">
        <div className="card skeleton" style={{ height: 120 }} />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="container page">
        <div className="empty-state">
          <div className="empty-icon">🧾</div>
          <h2>No orders yet</h2>
          <p className="muted">Your order history will appear here.</p>
          <Link to="/" className="btn btn-primary">
            Start shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container page">
      <h1 className="page-title">Your orders</h1>
      <div className="orders">
        {orders.map((order) => (
          <details key={order.id} className="card order" data-testid="order" open={orders.length === 1}>
            <summary className="order-head">
              <div>
                <strong>Order #{order.id}</strong>
                <span className="muted small">{formatDate(order.createdAt)}</span>
              </div>
              <span className={`badge badge-status-${order.status}`}>{order.status}</span>
              <strong className="order-total">{formatPrice(order.total)}</strong>
            </summary>
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Unit price</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.productName ?? 'Removed product'}</td>
                    <td>{item.quantity}</td>
                    <td>{formatPrice(item.unitPrice)}</td>
                    <td>{formatPrice(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        ))}
      </div>
    </div>
  );
}
