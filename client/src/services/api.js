import axios from 'axios';

const TOKEN_KEY = 'fixflow_token';

export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* private mode */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } },
};

const api = axios.create({ baseURL: `${import.meta.env.VITE_API_URL || ''}/api`, timeout: 20000 });

api.interceptors.request.use((config) => {
  const t = tokenStore.get();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

api.interceptors.response.use(
  (r) => r,
  (error) => {
    const url = error.config && error.config.url ? error.config.url : '';
    // a 401 anywhere except the login call itself means the session is gone
    if (error.response && error.response.status === 401 && !url.includes('/auth/login') && tokenStore.get()) {
      tokenStore.clear();
      if (onUnauthorized) onUnauthorized();
    }
    return Promise.reject(error);
  }
);

/** Human readable message from any axios error */
export function errMsg(error, fallback = 'Something went wrong. Please try again.') {
  if (error && error.response && error.response.data && error.response.data.message) return error.response.data.message;
  if (error && error.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  if (error && error.message === 'Network Error') return 'Cannot reach the server. Check your connection.';
  return fallback;
}

export default api;
