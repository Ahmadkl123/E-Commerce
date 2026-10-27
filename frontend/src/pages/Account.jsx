import { Fragment, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatPrice } from '../utils';

export default function Account() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    api.getOrders().then(
      (list) => {
        setOrders(list);
        if (list.length > 0) setOpenId(list[0].id);
      },
      (err) => setError(err.message)
    );
  }, []);

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
                        {order.paymentDetails && (
                          <p className="order-payment">Paid with {order.paymentDetails}</p>
                        )}
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
