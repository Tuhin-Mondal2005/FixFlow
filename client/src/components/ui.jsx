import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { AVAIL_STYLE, PAY_STYLE, STATUS_LABEL, STATUS_STYLE, URGENCY_STYLE, VERIFY_STYLE } from '../utils/format';

export function Spinner({ className = 'h-5 w-5' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="opacity-90" />
    </svg>
  );
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-3 text-ink-500" role="status">
      <Spinner className="h-6 w-6 text-brand-600" /> <span>{label}</span>
    </div>
  );
}

export function Skeleton({ className = 'h-24' }) { return <div className={`skeleton ${className}`} />; }

export function ErrorBox({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
      <span>{message}</span>
      {onRetry && <button className="btn-outline btn-sm" onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function EmptyState({ icon = '📭', title, text, action }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 text-4xl" aria-hidden="true">{icon}</div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {text && <p className="mt-1 max-w-md text-sm text-ink-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  // Portal into <body>: the page wrapper uses a CSS transform (animate-fadeIn), and a transformed
  // ancestor would otherwise trap this fixed overlay inside the page content area.
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`flex max-h-[90vh] w-full animate-fadeIn flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}>
        {/* header and footer stay visible; only the body scrolls */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-2xl leading-none text-ink-500 hover:bg-slate-100" aria-label="Close">×</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer && <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export const StatusBadge = ({ status }) => <span className={`badge ${STATUS_STYLE[status] || 'bg-slate-100 text-slate-700'}`}>{STATUS_LABEL[status] || status}</span>;
export const UrgencyBadge = ({ urgency }) => (
  <span className={`badge ${URGENCY_STYLE[urgency] || ''} ${urgency === 'HIGH' ? 'animate-pulseRing' : ''}`}>{urgency === 'HIGH' ? '🚨 ' : ''}{urgency}</span>
);
export const AvailabilityBadge = ({ status }) => <span className={`badge ${AVAIL_STYLE[status] || ''}`}>{String(status || '').replace('_', ' ')}</span>;
export const VerifyBadge = ({ status }) => <span className={`badge ${VERIFY_STYLE[status] || ''}`}>{status}</span>;
export const PayBadge = ({ status }) => <span className={`badge ${PAY_STYLE[status] || ''}`}>{status}</span>;

export function Stars({ value = 0, size = 'text-base', showNumber = true, count }) {
  const full = Math.round(value);
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Rated ${value} out of 5`}>
      <span className={`${size} leading-none text-amber-400`}>{'★'.repeat(full)}<span className="text-slate-300">{'★'.repeat(5 - full)}</span></span>
      {showNumber && <span className="text-sm font-semibold text-ink-700">{Number(value || 0).toFixed(1)}</span>}
      {count !== undefined && <span className="text-xs text-ink-500">({count})</span>}
    </span>
  );
}

export function StarInput({ value, onChange }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button type="button" key={n} role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => onChange(n)}
          className={`min-h-[44px] min-w-[44px] text-4xl leading-none transition hover:scale-110 ${n <= value ? 'text-amber-400' : 'text-slate-300'}`}>★</button>
      ))}
    </div>
  );
}

// accent: coloured left border (in the card's tone) instead of the icon box. Off by default, so other pages keep their icons.
export function StatCard({ label, value, icon, tone = 'brand', hint, to, accent = false }) {
  const tones = { brand: 'bg-brand-50 text-brand-700', amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-700', blue: 'bg-blue-50 text-blue-700', green: 'bg-green-50 text-green-700', purple: 'bg-purple-50 text-purple-700' };
  const accents = { brand: 'border-l-brand-600', amber: 'border-l-amber-500', red: 'border-l-red-500', blue: 'border-l-blue-500', green: 'border-l-green-500', purple: 'border-l-purple-500' };
  const body = (
    <div className={`card flex h-full items-start gap-3 p-3 transition hover:shadow-md sm:items-center sm:gap-4 sm:p-4 ${accent ? `border-l-4 ${accents[tone] || accents.brand}` : ''}`}>
      {!accent && <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg sm:h-12 sm:w-12 sm:text-2xl ${tones[tone]}`} aria-hidden="true">{icon}</div>}
      <div className="min-w-0">
        <div className="truncate text-xl font-bold sm:text-2xl">{value}</div>
        <div className="text-xs leading-snug text-ink-500 sm:text-sm">{label}</div>
        {hint && <div className="text-[11px] leading-snug text-ink-500 sm:text-xs">{hint}</div>}
      </div>
    </div>
  );
  return to ? <Link to={to} className="block rounded-2xl">{body}</Link> : body;
}

export function Pagination({ page, pages, onChange }) {
  if (!pages || pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-3 text-sm">
      <button className="btn-outline btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>← Prev</button>
      <span className="text-ink-500">Page {page} of {pages}</span>
      <button className="btn-outline btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next →</button>
    </div>
  );
}

export function Field({ label, error, hint, children, required }) {
  return (
    <div>
      {label && <label className="label">{label}{required && <span className="text-red-500"> *</span>}</label>}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1" role="tablist">
      {tabs.map((t) => (
        <button key={t.key} role="tab" aria-selected={value === t.key} onClick={() => onChange(t.key)}
          className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition ${value === t.key ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-500 hover:text-ink-900'}`}>
          {t.label}{t.count !== undefined && <span className="ml-1.5 rounded-full bg-slate-200 px-1.5 text-xs">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function ConfirmModal({ open, title, message, confirmLabel = 'Confirm', danger, busy, onConfirm, onClose, children }) {
  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={<><button className="btn-outline" onClick={onClose} disabled={busy}>Back</button><button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={busy}>{busy && <Spinner className="h-4 w-4" />}{confirmLabel}</button></>}>
      <p className="text-sm text-ink-700">{message}</p>
      {children}
    </Modal>
  );
}
