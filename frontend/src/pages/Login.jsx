import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const DEMO_ACCOUNTS = [
  { label: 'Customer demo', email: 'customer@example.com', password: 'customer123' },
  { label: 'Admin demo', email: 'admin@example.com', password: 'admin123' },
];

export default function Login() {
  const { user, isAdmin, login } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Once signed in (including right after submitting), send the user on:
  // back to the page that required login, else admins to the dashboard.
  if (user) {
    return <Navigate to={location.state?.from || (isAdmin ? '/admin' : '/')} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const loggedIn = await login(email, password);
      toast(`Welcome back, ${loggedIn.email}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="container page auth-page">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <h1>Sign in</h1>
        <p className="muted">Welcome back! Sign in to shop and track orders.</p>

        {error && <div className="alert alert-error">{error}</div>}

        <label className="field">
          <span>Email</span>
          <input
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <div className="demo-accounts">
          <span className="muted small">Quick fill:</span>
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.email}
              type="button"
              className="chip"
              onClick={() => {
                setEmail(acc.email);
                setPassword(acc.password);
              }}
            >
              {acc.label}
            </button>
          ))}
        </div>

        <p className="center small">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </div>
  );
}
