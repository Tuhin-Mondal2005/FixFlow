import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorBox, Field, Modal, Skeleton, Spinner, Tabs } from '../../components/ui';
import { useLiveRefresh } from '../../context/RealtimeContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useAsync';
import api, { errMsg } from '../../services/api';
import { dateTime } from '../../utils/format';

const TONE = { OPEN: 'bg-amber-100 text-amber-800', IN_REVIEW: 'bg-blue-100 text-blue-700', RESOLVED: 'bg-green-100 text-green-700', REJECTED: 'bg-slate-200 text-slate-700' };

export default function SupportAdmin() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const { data, loading, error, reload } = useFetch('/admin/support', status ? { status } : undefined);
  useLiveRefresh(reload);
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState({ status: 'IN_REVIEW', adminNote: '' });
  const [busy, setBusy] = useState(false);

  const openT = (t) => { setSel(t); setForm({ status: t.status === 'OPEN' ? 'IN_REVIEW' : t.status, adminNote: t.adminNote || '' }); };
  const save = async () => {
    setBusy(true);
    try { await api.put(`/admin/support/${sel._id}`, form); toast.success('Ticket updated'); setSel(null); reload(false); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <h1 className="page-title">Support &amp; disputes</h1>
      <Tabs value={status} onChange={setStatus} tabs={[{ key: '', label: 'All' }, { key: 'OPEN', label: 'Open' }, { key: 'IN_REVIEW', label: 'In review' }, { key: 'RESOLVED', label: 'Resolved' }, { key: 'REJECTED', label: 'Rejected' }]} />
      <ErrorBox message={error} onRetry={reload} />
      {loading ? <Skeleton className="h-48" /> : data && data.tickets.length ? (
        <div className="grid gap-3 md:grid-cols-2">{data.tickets.map((t) => (
          <article key={t._id} className="card p-4">
            <div className="flex items-start justify-between gap-2"><div><div className="text-xs text-ink-500">Ticket #{t.ticketNumber} · Request #{t.requestNumber} · {t.category}</div><h2 className="font-bold">{t.subject}</h2></div><span className={`badge ${TONE[t.status]}`}>{t.status.replace('_', ' ')}</span></div>
            <p className="mt-2 line-clamp-3 text-sm text-ink-700">{t.message}</p>
            <div className="mt-3 flex items-center justify-between text-xs text-ink-500"><span>{t.customerId ? t.customerId.name : '—'} · {dateTime(t.createdAt)}</span><button className="btn-outline btn-sm" onClick={() => openT(t)}>Review</button></div>
          </article>))}</div>
      ) : <EmptyState icon="🎧" title="No tickets" text="Customer disputes will show up here." />}

      {sel && (
        <Modal open onClose={() => setSel(null)} title={`Ticket #${sel.ticketNumber}`} wide
          footer={<><button className="btn-outline" onClick={() => setSel(null)}>Close</button><button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Save &amp; notify customer</button></>}>
          <div className="space-y-4 text-sm">
            <div><div className="text-xs text-ink-500">{sel.customerId && `${sel.customerId.name} · ${sel.customerId.phone}`} · {sel.category}</div><h3 className="text-base font-bold">{sel.subject}</h3><p className="mt-1 whitespace-pre-wrap">{sel.message}</p>
              <Link className="mt-2 inline-block font-semibold text-brand-700 hover:underline" to={`/admin/requests/${sel.requestId}`}>Open request #{sel.requestNumber} →</Link></div>
            <Field label="Status"><select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="OPEN">Open</option><option value="IN_REVIEW">In review</option><option value="RESOLVED">Resolved</option><option value="REJECTED">Rejected</option></select></Field>
            <Field label="Note to customer" hint="Shown to the customer in their notification"><textarea className="input min-h-[90px]" maxLength={1000} value={form.adminNote} onChange={(e) => setForm({ ...form, adminNote: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
