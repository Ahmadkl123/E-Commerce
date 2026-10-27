import { useEffect } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import CartDrawer from './components/CartDrawer';
import Footer from './components/Footer';
import Header from './components/Header';
import RequireAuth from './components/RequireAuth';
import Account from './pages/Account';
import AdminDashboard from './pages/admin/AdminDashboard';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Home from './pages/Home';
import Login from './pages/Login';
import ProductDetail from './pages/ProductDetail';
import Register from './pages/Register';
import Shop from './pages/Shop';

function NotFound() {
  return (
    <div className="container page">
      <div className="empty-state">
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <p className="muted">The page you were looking for doesn't exist or has moved.</p>
        <Link to="/shop" className="btn btn-dark">
          Continue shopping
        </Link>
      </div>
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith('/admin');

  return (
    <div className="app">
      <ScrollToTop />
      <Header />
      <main className={isAdmin ? 'main-admin' : ''}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/cart"
            element={
              <RequireAuth>
                <Cart />
              </RequireAuth>
            }
          />
          <Route
            path="/checkout"
            element={
              <RequireAuth>
                <Checkout />
              </RequireAuth>
            }
          />
          <Route
            path="/account"
            element={
              <RequireAuth>
                <Account />
              </RequireAuth>
            }
          />
          <Route path="/orders" element={<Navigate to="/account" replace />} />
          <Route
            path="/admin"
            element={
              <RequireAuth admin>
                <AdminDashboard />
              </RequireAuth>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {!isAdmin && <Footer />}
      <CartDrawer />
    </div>
  );
}
