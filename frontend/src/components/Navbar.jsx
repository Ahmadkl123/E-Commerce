import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [location.pathname]);

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="brand">
          <span className="brand-mark">N</span>
          Nova<span className="brand-accent">Store</span>
        </Link>

        <button
          className="nav-toggle"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={`nav-links ${open ? 'open' : ''}`}>
          <NavLink to="/" end>
            Shop
          </NavLink>
          {user && <NavLink to="/orders">Orders</NavLink>}
          {isAdmin && <NavLink to="/admin">Dashboard</NavLink>}
          <NavLink to="/cart" className="cart-link" aria-label="Cart">
            Cart
            {count > 0 && (
              <span className="cart-count" data-testid="cart-count">
                {count}
              </span>
            )}
          </NavLink>
          {user ? (
            <div className="nav-user">
              <span className="nav-email" title={user.email}>
                {user.email}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
                Log out
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn btn-primary btn-sm">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
