import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { setUnauthorizedHandler, tokenStore } from '../services/api';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export const HOME_BY_ROLE = { CUSTOMER: '/customer/dashboard', TECHNICIAN: '/technician/dashboard', ADMIN: '/admin/dashboard' };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [technician, setTechnician] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  const clear = useCallback(() => { tokenStore.clear(); setUser(null); setTechnician(null); }, []);

  useEffect(() => { setUnauthorizedHandler(() => { clear(); }); }, [clear]);

  // Restore the session on first load
  useEffect(() => {
    if (!tokenStore.get()) return;
    api.get('/auth/me')
      .then(({ data }) => { setUser(data.user); setTechnician(data.technician || null); })
      .catch(() => clear())
      .finally(() => setLoading(false));
  }, [clear]);

  const login = useCallback(async (email, password, portal) => {
    const { data } = await api.post('/auth/login', { email, password, portal });
    tokenStore.set(data.token);
    setUser(data.user);
    setTechnician(data.technician || null);
    return data.user;
  }, []);

  const logout = useCallback(() => clear(), [clear]);

  const refreshUser = useCallback(async () => {
    const { data } = await api.get('/auth/me');
    setUser(data.user);
    setTechnician(data.technician || null);
  }, []);

  const value = useMemo(() => ({ user, technician, loading, login, logout, refreshUser, setUser, isAuthed: Boolean(user) }), [user, technician, loading, login, logout, refreshUser]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
