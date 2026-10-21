import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Register() {
  const { user, register } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    // Mirror the backend rules so users get instant feedback.
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await register(email, password);
      toast('Account created. Welcome to Nova Store!');
      // The `if (user)` redirect above takes over once the session is set.
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="container page auth-page">
      <form className="card auth-card" onSubmit={handleSubmit} noValidate>
        <h1>Create account</h1>
        <p className="muted">Join Nova Store in seconds.</p>

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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Confirm password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </label>

        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>

        <p className="center small">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
