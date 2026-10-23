import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { CATEGORIES } from '../catalog';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { FREE_SHIPPING_THRESHOLD } from '../utils';
import { BagIcon, CloseIcon, MenuIcon, SearchIcon, UserIcon } from './Icons';

export default function Header() {
  const { user, isAdmin } = useAuth();
  const { count, openDrawer } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchInput = useRef(null);

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);

  function handleSearch(e) {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/shop?q=${encodeURIComponent(q)}` : '/shop');
  }

  return (
    <header className="site-header">
      <div className="announcement">
        Free standard shipping on orders over ${FREE_SHIPPING_THRESHOLD} &nbsp;·&nbsp; 30-day returns
      </div>

      <div className="header-bar">
        <div className="container header-inner">
          <button
            className="header-icon menu-toggle"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <MenuIcon />
          </button>

          <Link to="/" className="wordmark" aria-label="Kestrel home">
            Kestrel
          </Link>

          <nav className="primary-nav" aria-label="Primary">
            <NavLink to="/shop" end>
              Shop all
            </NavLink>
            {CATEGORIES.map((c) => (
              <NavLink key={c.slug} to={`/shop?category=${c.slug}`}>
                {c.label}
              </NavLink>
            ))}
          </nav>

          <div className="header-actions">
            {isAdmin && (
              <Link to="/admin" className="header-text-link">
                Admin
              </Link>
            )}
            <button
              className="header-icon"
              aria-label="Search"
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((o) => !o)}
            >
              <SearchIcon />
            </button>
            <Link
              to={user ? '/account' : '/login'}
              className="header-icon"
              aria-label={user ? 'Account' : 'Sign in'}
            >
              <UserIcon />
            </Link>
            <button className="header-icon bag-button" aria-label="Cart" onClick={openDrawer}>
              <BagIcon />
              {count > 0 && (
                <span className="bag-count" data-testid="cart-count">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>

        {searchOpen && (
          <form className="search-panel" onSubmit={handleSearch} role="search">
            <div className="container search-panel-inner">
              <SearchIcon />
              <input
                ref={searchInput}
                type="search"
                placeholder="Search products"
                aria-label="Search products"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button type="button" className="header-icon" aria-label="Close search" onClick={() => setSearchOpen(false)}>
                <CloseIcon />
              </button>
            </div>
          </form>
        )}
      </div>

      {menuOpen && (
        <div className="drawer-backdrop" onClick={() => setMenuOpen(false)}>
          <aside className="drawer drawer-left" onClick={(e) => e.stopPropagation()} aria-label="Menu">
            <div className="drawer-head">
              <span className="wordmark">Kestrel</span>
              <button className="header-icon" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
                <CloseIcon />
              </button>
            </div>
            <nav className="mobile-nav">
              <Link to="/shop">Shop all</Link>
              {CATEGORIES.map((c) => (
                <Link key={c.slug} to={`/shop?category=${c.slug}`}>
                  {c.label}
                </Link>
              ))}
              <hr />
              {user ? <Link to="/account">Account</Link> : <Link to="/login">Sign in</Link>}
              {isAdmin && <Link to="/admin">Admin</Link>}
            </nav>
          </aside>
        </div>
      )}
    </header>
  );
}
