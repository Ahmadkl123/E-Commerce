import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RequireAuth({ children, admin = false }) {
  const { user, isAdmin } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (admin && !isAdmin) {
    return (
      <div className="container page">
        <div className="empty-state">
          <div className="empty-icon">🔒</div>
          <h2>Admins only</h2>
          <p className="muted">You need an administrator account to view the dashboard.</p>
        </div>
      </div>
    );
  }
  return children;
}
