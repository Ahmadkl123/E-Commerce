import { Fragment, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { DownloadIcon } from '../components/Icons';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatDate, formatPrice } from '../utils';

export default function Account() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const toast = useToast();

  useEffect(() => {
    api.getOrders().then(
      (list) => {
        setOrders(list);
        if (list.length > 0) setOpenId(list[0].id);
      },
      (err) => setError(err.message)
    );
  }, []);

  // Fetches the PDF receipt (the request needs the auth token) and saves it.
  async function downloadReceipt(orderId) {
    setDownloadingId(orderId);
    try {
      const blob = await api.getReceipt(orderId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `kestrel-receipt-${orderId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setDownloadingId(null);
    }
  }

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <div className="container page account">
      <div className="account-head">
        <div>
          <h1 className="page-title">Account</h1>
          <p className="muted">
            Signed in as <strong className="account-email">{user.email}</strong>
            {isAdmin && ' · Administrator'}
          </p>
        </div>
        <button className="btn btn-outline" onClick={handleLogout}>
          Log out
        </button>
      </div>

      <h2 className="account-section-title">Order history</h2>

      {error && <div className="alert alert-error">{error}</div>}

      {!orders && !error && <div className="skeleton skeleton-block" />}

      {orders?.length === 0 && (
        <div className="account-empty">
          <p>You haven't placed any orders yet.</p>
          <Link to="/shop" className="btn btn-dark">
            Start shopping
          </Link>
        </div>
      )}

      {orders?.length > 0 && (
        <div className="table-wrap">
          <table className="table orders-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th>Status</th>
                <th>Items</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <Fragment key={order.id}>
                  <tr
                    className="order-row"
                    data-testid="order"
                    onClick={() => setOpenId(openId === order.id ? null : order.id)}
                  >
                    <td>
                      <button className="order-toggle" aria-expanded={openId === order.id}>
                        #{order.id}
                      </button>
                    </td>
                    <td>{formatDate(order.createdAt)}</td>
                    <td>
                      <span className={`status status-${order.status}`}>{order.status}</span>
                    </td>
                    <td>{order.items.reduce((s, i) => s + i.quantity, 0)}</td>
                    <td className="num">{formatPrice(order.total)}</td>
                  </tr>
                  {openId === order.id && (
                    <tr className="order-detail">
                      <td colSpan={5}>
                        <div className="order-detail-head">
                          <div>
                            <p className="order-number">Order #{order.id}</p>
                            {order.paymentDetails && (
                              <p className="order-payment">Paid with {order.paymentDetails}</p>
                            )}
                          </div>
                          <button
                            className="btn btn-outline receipt-button"
                            onClick={() => downloadReceipt(order.id)}
                            disabled={downloadingId === order.id}
                          >
                            <DownloadIcon size={16} />
                            {downloadingId === order.id ? 'Preparing…' : 'Download receipt (PDF)'}
                          </button>
                        </div>
                        <ul>
                          {order.items.map((item) => (
                            <li key={item.id}>
                              <span>
                                {item.productName ?? 'Removed product'} <span className="muted">× {item.quantity}</span>
                              </span>
                              <span>{formatPrice(item.subtotal)}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
