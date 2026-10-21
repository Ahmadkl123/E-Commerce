import { Link, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import RequireAuth from './components/RequireAuth';
import Home from './pages/Home';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Orders from './pages/Orders';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/admin/AdminDashboard';

function NotFound() {
  return (
    <div className="container page">
      <div className="empty-state">
        <div className="empty-icon">🛸</div>
        <h2>Page not found</h2>
        <p className="muted">The page you're looking for drifted off into space.</p>
        <Link to="/" className="btn btn-primary">
          Back to shop
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div className="app">
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
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
            path="/orders"
            element={
              <RequireAuth>
                <Orders />
              </RequireAuth>
            }
          />
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
      <footer className="footer">
        <div className="container footer-inner">
          <span>© {new Date().getFullYear()} Nova Store</span>
          <span className="muted">E-Commerce CI/CD Project</span>
        </div>
      </footer>
    </div>
  );
}
