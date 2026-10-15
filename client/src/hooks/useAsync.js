import { useCallback, useEffect, useRef, useState } from 'react';
import api, { errMsg } from '../services/api';

/** GET helper with loading / error state and a manual reload() (silent reloads keep the old data on screen). */
export function useFetch(url, params, { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');
  const key = JSON.stringify([url, params]);
  const reqId = useRef(0);

  const load = useCallback(async (silent = false) => {
    if (!enabled || !url) return;
    const id = ++reqId.current;
    if (!silent) setLoading(true);
    try {
      const { data: d } = await api.get(url, { params });
      if (id === reqId.current) { setData(d); setError(''); }
    } catch (e) {
      if (id === reqId.current) setError(errMsg(e));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  useEffect(() => { load(); }, [load]);
  const reload = useCallback((silent = true) => load(silent), [load]);
  return { data, loading, error, reload, setData };
}

/** Wrap an async action: tracks `busy` and reports errors through the supplied handler. */
export function useAction(onError) {
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn) => {
    setBusy(true);
    try { return await fn(); } catch (e) { if (onError) onError(errMsg(e), e); return undefined; } finally { setBusy(false); }
  }, [onError]);
  return [run, busy];
}
