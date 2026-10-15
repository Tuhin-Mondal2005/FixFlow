import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastCtx = createContext(null);
export const useToast = () => useContext(ToastCtx);

const STYLES = {
  success: 'border-green-200 bg-green-50 text-green-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-slate-200 bg-white text-ink-900',
};

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const idRef = useRef(0);

  const remove = useCallback((id) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback((message, type = 'info', ms = 4500) => {
    const id = ++idRef.current;
    setItems((xs) => [...xs.slice(-3), { id, message, type }]);
    setTimeout(() => remove(id), ms);
  }, [remove]);

  const api = useMemo(() => ({
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error', 6500),
    info: (m) => push(m, 'info'),
  }), [push]);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-3 sm:items-end sm:pr-5" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} role="status" className={`pointer-events-auto flex w-full max-w-sm animate-fadeIn items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${STYLES[t.type]}`}>
            <span className="flex-1">{t.message}</span>
            <button onClick={() => remove(t.id)} className="text-lg leading-none opacity-60 hover:opacity-100" aria-label="Dismiss">×</button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
