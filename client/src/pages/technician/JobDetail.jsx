import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Countdown } from '../../components/JobCard';
import { MapView } from '../../components/Maps';
import Timeline from '../../components/Timeline';
import { ErrorBox, Field, Modal, PageLoader, PayBadge, Spinner, StatusBadge, UrgencyBadge } from '../../components/ui';
import { useLiveRefresh, useRealtime } from '../../context/RealtimeContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useAsync';
import { useJobActions } from '../../hooks/useJobActions';
import api, { errMsg } from '../../services/api';
import { dateTime, directionsUrl, hhmmTo12, inr } from '../../utils/format';

const NEXT = {
  ACCEPTED: { to: 'ON_THE_WAY', label: '🚗 Start travel — I\'m on the way' },
  ON_THE_WAY: { to: 'ARRIVED', label: '📍 I have arrived' },
  ARRIVED: { to: 'SERVICE_STARTED', label: '🔧 Start service' },
  SERVICE_STARTED: { to: 'COMPLETED', label: '✅ Complete job' },
};
const TRACKING = ['ON_THE_WAY', 'ARRIVED', 'SERVICE_STARTED'];

export default function TechJobDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { emit, connected } = useRealtime();
  const { data, loading, error, reload } = useFetch(`/jobs/${id}`);
  useLiveRefresh(reload);
  const actions = useJobActions(reload);
  const [busy, setBusy] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [bill, setBill] = useState({ finalAmount: '', billNote: '' });
  const watchRef = useRef(null);
  const lastSent = useRef(0);
  const job = data && data.job;

  // Share live position with the customer while travelling / on site (throttled to one update per 8 s)
  const status = job && job.status;
  useEffect(() => {
    if (!connected || !TRACKING.includes(status) || !navigator.geolocation) return undefined;
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => { const now = Date.now(); if (now - lastSent.current < 8000) return; lastSent.current = now; emit('technician:location', { latitude: pos.coords.latitude, longitude: pos.coords.longitude }); },
      () => { /* permission denied - tracking is optional */ },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    return () => { if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current); };
  }, [status, connected, emit]);

  if (loading) return <PageLoader />;
  if (error || !job) return <div className="space-y-3"><ErrorBox message={error || 'Job not found'} onRetry={reload} /><Link to="/technician/jobs" className="btn-outline">← Jobs</Link></div>;
  const next = NEXT[job.status];

  const advance = async (body) => {
    setBusy(true);
    try { await api.put(`/jobs/${id}/status`, body); toast.success('Status updated'); setCompleteOpen(false); reload(false); } catch (e) { toast.error(errMsg(e)); reload(); } finally { setBusy(false); }
  };
  const onNext = () => (next.to === 'COMPLETED' ? (setBill({ finalAmount: String(job.price), billNote: '' }), setCompleteOpen(true)) : advance({ status: next.to }));
  const submitComplete = () => {
    const amt = Number(bill.finalAmount);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error('Enter the final bill amount');
    advance({ status: 'COMPLETED', finalAmount: amt, billNote: bill.billNote.trim() || undefined });
  };
  const confirmCash = async () => {
    setBusy(true);
    try { await api.put(`/payments/${job.payment._id}/confirm-cash`); toast.success('Cash payment confirmed'); reload(false); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <Link to="/technician/jobs" className="text-sm font-semibold text-brand-700 hover:underline">← Jobs</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="text-sm text-ink-500">Request #{job.requestNumber}</div><h1 className="page-title">{job.serviceName}{job.packageName ? ` · ${job.packageName}` : ''}</h1></div>
        <div className="flex gap-2"><UrgencyBadge urgency={job.urgency} /><StatusBadge status={job.status} /></div>
      </div>

      {job.status === 'ASSIGNED' && (
        <div className="space-y-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
          <div className="font-bold">New request — respond within {job.expiresAt && <Countdown to={job.expiresAt} />}</div>
          <div className="flex gap-2"><button className="btn-primary flex-1" disabled={actions.busyId === job._id} onClick={() => actions.accept(job)}>✔ Accept</button><button className="btn-outline flex-1" onClick={() => actions.reject(job)}>✕ Reject</button></div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <section className="card-pad space-y-3 text-sm">
            <h2 className="font-bold">Job details</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              <div><div className="text-xs text-ink-500">Customer</div><b>{job.customer && job.customer.name}</b></div>
              {job.revealed && job.customer.phone && <div><div className="text-xs text-ink-500">Contact</div><a className="font-semibold text-brand-700" href={`tel:${job.customer.phone}`}>📞 {job.customer.phone}</a></div>}
              <div><div className="text-xs text-ink-500">Scheduled</div>{dateTime(job.scheduledAt)} ({hhmmTo12(job.preferredTime)})</div>
              <div><div className="text-xs text-ink-500">Distance</div>{job.distanceKm} km from your base</div>
              <div className="sm:col-span-2"><div className="text-xs text-ink-500">Problem</div>{job.problemDescription}</div>
              <div className="sm:col-span-2"><div className="text-xs text-ink-500">Address</div>{job.location.address}</div>
              <div><div className="text-xs text-ink-500">{job.finalAmount != null ? 'Final bill' : 'Estimated price'}</div><b>{inr(job.finalAmount ?? job.price)}</b></div>
              {job.payment && <div><div className="text-xs text-ink-500">Payment</div><PayBadge status={job.payment.status} /> <span className="text-xs text-ink-500">{job.payment.method || 'not chosen yet'}</span></div>}
            </div>
            {!job.revealed && <p className="rounded-lg bg-slate-50 p-2 text-xs text-ink-500">The exact address, map pin and phone number are shown after you accept.</p>}
            <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Service only — any replacement part is arranged by the customer.</p>
          </section>

          {next && (
            <section className="card-pad space-y-2">
              <h2 className="font-bold">Update status</h2>
              <button className="btn-primary btn-lg w-full" onClick={onNext} disabled={busy}>{busy && <Spinner className="h-4 w-4" />} {next.label}</button>
              {TRACKING.includes(job.status) && <p className="text-xs text-ink-500">Your live position is shared with the customer while you travel (location permission required).</p>}
            </section>
          )}

          {job.status === 'COMPLETED' && job.payment && job.payment.method === 'CASH' && job.payment.status === 'PENDING' && (
            <section className="card-pad space-y-2 border-2 border-green-200"><h2 className="font-bold">Cash payment</h2><p className="text-sm">The customer chose to pay <b>{inr(job.payment.amount)}</b> in cash. Confirm once you have received it.</p><button className="btn-primary" onClick={confirmCash} disabled={busy}>💵 Confirm cash received</button></section>
          )}
          {job.status === 'COMPLETED' && job.payment && job.payment.status === 'PENDING' && job.payment.method !== 'CASH' && <p className="rounded-xl bg-slate-100 p-3 text-sm">Waiting for the customer to pay.</p>}
          {job.status === 'COMPLETED' && job.payment && job.payment.status === 'PAID' && <p className="rounded-xl bg-green-50 p-3 text-sm text-green-800">Paid. See your <Link to="/technician/earnings" className="font-semibold underline">earnings</Link>.</p>}
        </div>

        <div className="space-y-6">
          <section className="card-pad"><h2 className="mb-4 font-bold">Progress</h2><Timeline steps={job.timeline} /></section>
          {job.revealed && job.location.latitude !== undefined && (
            <section className="card-pad space-y-3"><h2 className="font-bold">Customer location</h2>
              <MapView latitude={job.location.latitude} longitude={job.location.longitude} showDirections={false} />
              <div className="flex flex-wrap gap-2"><a className="btn-primary" href={directionsUrl(job.location.latitude, job.location.longitude)} target="_blank" rel="noopener noreferrer">🧭 Navigate to customer</a></div>
            </section>
          )}
        </div>
      </div>

      <Modal open={completeOpen} onClose={() => setCompleteOpen(false)} title="Complete job — final bill"
        footer={<><button className="btn-outline" onClick={() => setCompleteOpen(false)}>Back</button><button className="btn-primary" onClick={submitComplete} disabled={busy}>{busy && <Spinner className="h-4 w-4" />} Complete & send bill</button></>}>
        <div className="space-y-3">
          <Field label="Final amount (₹)" hint={`Quoted ${inr(job.price)}. Labour / service charge only — parts are not billed by FixFlow.`} required><input className="input" type="number" min="1" step="1" value={bill.finalAmount} onChange={(e) => setBill({ ...bill, finalAmount: e.target.value })} /></Field>
          <Field label="Note for the customer (optional)"><textarea className="input" rows={2} maxLength={300} value={bill.billNote} onChange={(e) => setBill({ ...bill, billNote: e.target.value })} /></Field>
        </div>
      </Modal>
      {actions.modal}
    </div>
  );
}
