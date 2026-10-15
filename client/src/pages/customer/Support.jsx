import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorBox, Field, PageLoader, Spinner } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useAsync';
import api, { errMsg } from '../../services/api';
import { dateOnly } from '../../utils/format';

const CATS = [['QUALITY', 'Quality of work'], ['BILLING', 'Billing / price'], ['BEHAVIOUR', 'Technician behaviour'], ['NO_SHOW', 'Technician did not arrive'], ['OTHER', 'Something else']];
const STATUS_STYLE = { OPEN: 'bg-amber-100 text-amber-800', IN_REVIEW: 'bg-blue-100 text-blue-700', RESOLVED: 'bg-green-100 text-green-700', REJECTED: 'bg-slate-200 text-slate-700' };

export default function Support() {
  const [params] = useSearchParams();
  const toast = useToast();
  const tickets = useFetch('/support/my');
  const done = useFetch('/requests/my', { group: 'completed', limit: 50 });
  const [form, setForm] = useState({ requestId: params.get('request') || '', category: 'QUALITY', subject: '', message: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (!form.requestId) er.requestId = 'Choose the service';
    if (form.subject.trim().length < 3) er.subject = 'Add a short subject';
    if (form.message.trim().length < 10) er.message = 'Please describe the problem (at least 10 characters)';
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try { await api.post('/support', form); toast.success('Support request sent. We will get back to you.'); setForm({ ...form, subject: '', message: '' }); tickets.reload(); } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };

  if (tickets.loading || done.loading) return <PageLoader />;
  const completed = done.data ? done.data.requests : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-4">
        <h1 className="page-title">Support</h1>
        <p className="text-sm text-ink-500">Had a problem with a completed service? Raise a request and our team will review it.</p>
        <form onSubmit={submit} className="card-pad space-y-4" noValidate>
          <Field label="Service" error={errors.requestId} required>
            <select className="input" value={form.requestId} onChange={(e) => setForm({ ...form, requestId: e.target.value })}>
              <option value="">Select a completed service…</option>
              {completed.map((r) => <option key={r._id} value={r._id}>#{r.requestNumber} · {r.serviceName} · {dateOnly(r.completedAt)}</option>)}
            </select>
          </Field>
          <Field label="What happened?"><select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Subject" error={errors.subject} required><input className="input" maxLength={120} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></Field>
          <Field label="Details" error={errors.message} required><textarea className="input" rows={4} maxLength={2000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></Field>
          <button className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4" />} Send</button>
        </form>
      </div>
      <div className="space-y-3">
        <h2 className="section-title">Your requests</h2>
        <ErrorBox message={tickets.error} onRetry={tickets.reload} />
        {tickets.data && tickets.data.tickets.length ? tickets.data.tickets.map((t) => (
          <div key={t._id} className="card p-4"><div className="flex items-start justify-between gap-2"><div><div className="text-xs text-ink-500">Ticket #{t.ticketNumber} · Request #{t.requestNumber}</div><div className="font-semibold">{t.subject}</div></div><span className={`badge ${STATUS_STYLE[t.status]}`}>{t.status.replace('_', ' ')}</span></div>
            <p className="mt-2 text-sm text-ink-700">{t.message}</p>{t.adminNote && <p className="mt-2 rounded-lg bg-brand-50 p-2 text-sm"><b>FixFlow:</b> {t.adminNote}</p>}</div>
        )) : <EmptyState icon="🛟" title="No support requests" />}
      </div>
    </div>
  );
}
