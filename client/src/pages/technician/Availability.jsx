import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AvailabilityBadge, ErrorBox, Field, PageLoader, Spinner } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useAsync';
import api, { errMsg } from '../../services/api';
import { dateTime, toLocalInput } from '../../utils/format';

const OPTIONS = [
  { key: 'AVAILABLE', label: 'Available', icon: '🟢', hint: 'Receive new jobs' },
  { key: 'BUSY', label: 'Busy', icon: '🟠', hint: 'Busy now, free again later' },
  { key: 'OFFLINE', label: 'Offline', icon: '⚫', hint: 'Not taking jobs' },
  { key: 'ON_LEAVE', label: 'On leave', icon: '🏖️', hint: 'Away for a longer time' },
];

export default function Availability() {
  const toast = useToast();
  const { data, loading, error, reload } = useFetch('/technicians/dashboard');
  const [status, setStatus] = useState('AVAILABLE');
  const [from, setFrom] = useState('');
  const [hours, setHours] = useState({ start: '08:00', end: '20:00' });
  const [busy, setBusy] = useState(false);
  const t = data && data.technician;

  useEffect(() => {
    if (!t) return;
    setStatus(t.availabilityStatus);
    setFrom(t.availableFrom ? toLocalInput(t.availableFrom) : toLocalInput(new Date(Date.now() + 3 * 3600000)));
    if (t.workingHours) setHours(t.workingHours);
  }, [t && t.availabilityStatus, t && t.availableFrom]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <PageLoader />;
  if (error || !t) return <ErrorBox message={error || 'Could not load'} onRetry={reload} />;

  const save = async (e) => {
    e.preventDefault();
    if (status === 'BUSY' && (!from || new Date(from) <= new Date())) return toast.error('"Available after" must be a future time');
    if (hours.start >= hours.end) return toast.error('Working hours: start must be before end');
    setBusy(true);
    try {
      await api.put('/technicians/availability', { availabilityStatus: status, availableFrom: status === 'BUSY' ? new Date(from).toISOString() : null, workingHours: hours });
      toast.success('Availability updated');
      reload(false);
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div><h1 className="page-title">Availability</h1><p className="text-ink-500">The assignment engine only offers you jobs that fit this schedule.</p></div>
      <div className="card-pad flex flex-wrap items-center gap-3 text-sm">Current: <AvailabilityBadge status={t.availabilityStatus} /> <span className="text-ink-500">{t.currentStatus}</span>{t.availabilityStatus === 'BUSY' && t.availableFrom && <span>· Available after <b>{dateTime(t.availableFrom)}</b></span>}</div>

      <form onSubmit={save} className="card-pad space-y-5">
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Status">
          {OPTIONS.map((o) => (
            <label key={o.key} className={`cursor-pointer rounded-xl border-2 p-4 transition ${status === o.key ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:border-slate-300'}`}>
              <input type="radio" name="status" className="sr-only" checked={status === o.key} onChange={() => setStatus(o.key)} />
              <div className="font-semibold">{o.icon} {o.label}</div><div className="text-xs text-ink-500">{o.hint}</div>
            </label>
          ))}
        </div>

        {status === 'BUSY' && (
          <Field label="Available after" hint="Future availability: you can still receive jobs scheduled after this time." required>
            <input className="input" type="datetime-local" value={from} min={toLocalInput(new Date())} onChange={(e) => setFrom(e.target.value)} />
          </Field>
        )}
        {['OFFLINE', 'ON_LEAVE'].includes(status) && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Jobs you have not answered yet will be offered to other technicians. You can't go offline while you hold accepted jobs.</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Working hours — start"><input className="input" type="time" value={hours.start} onChange={(e) => setHours({ ...hours, start: e.target.value })} /></Field>
          <Field label="Working hours — end"><input className="input" type="time" value={hours.end} onChange={(e) => setHours({ ...hours, end: e.target.value })} /></Field>
        </div>
        <p className="text-xs text-ink-500">Emergency (HIGH urgency) requests may be offered outside working hours.</p>
        <button className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4" />} Save availability</button>
      </form>
      <p className="text-sm text-ink-500">Looking for work? <Link to="/technician/jobs" className="font-semibold text-brand-700 hover:underline">See your jobs</Link></p>
    </div>
  );
}
