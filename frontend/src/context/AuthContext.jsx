import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAuthToken, setSessionExpiredHandler } from '../api/client';

const STORAGE_KEY = 'nova.auth';
const AuthContext = createContext(null);

function loadSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.token && saved?.user) return saved;
  } catch {
    // ignore corrupt or unavailable storage
  }
  return null;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    const saved = loadSession();
    setAuthToken(saved?.token ?? null);
    return saved;
  });

  const persist = useCallback((next) => {
    setAuthToken(next?.token ?? null);
    setSession(next);
    try {
      if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage may be blocked; the session still works for this tab
    }
  }, []);

  const logout = useCallback(() => persist(null), [persist]);

  useEffect(() => {
    setSessionExpiredHandler(logout);
    return () => setSessionExpiredHandler(null);
  }, [logout]);

  const login = useCallback(
    async (email, password) => {
      const { token, user } = await api.login(email, password);
      persist({ token, user });
      return user;
    },
    [persist]
  );

  const register = useCallback(
    async (email, password) => {
      await api.register(email, password);
      return login(email, password);
    },
    [login]
  );

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      isAdmin: session?.user?.role === 'admin',
      login,
      register,
      logout,
    }),
    [session, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
