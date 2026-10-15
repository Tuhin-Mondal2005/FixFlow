import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapView } from '../../components/Maps';
import Timeline from '../../components/Timeline';
import { ConfirmModal, ErrorBox, Field, Modal, PageLoader, PayBadge, Spinner, Stars, StatusBadge, UrgencyBadge } from '../../components/ui';
import { useLiveRefresh, useRealtime } from '../../context/RealtimeContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useAsync';
import api, { errMsg } from '../../services/api';
import { dateTime, hhmmTo12, inr, todayStr } from '../../utils/format';

export default function RequestDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { subscribe, emit, connected } = useRealtime();
  const { data, loading, error, reload } = useFetch(`/requests/${id}`);
  const [live, setLive] = useState(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reschedOpen, setReschedOpen] = useState(false);
  const [rs, setRs] = useState({ preferredDate: todayStr(), preferredTime: '10:00' });
  const [busy, setBusy] = useState(false);

  useLiveRefresh(reload);

  // Join the tracking room and follow the technician's position
  useEffect(() => {
    if (!connected) return undefined;
    emit('request:join', id);
    const off = subscribe((event, p) => { if (event === 'technician:location' && p.requestId === id) setLive({ latitude: p.latitude, longitude: p.longitude }); });
    return () => { off(); emit('request:leave', id); };
  }, [id, connected, emit, subscribe]);

  if (loading) return <PageLoader />;
  if (error || !data) return <div className="space-y-3"><ErrorBox message={error || 'Request not found'} onRetry={reload} /><Link to="/customer/requests" className="btn-outline">← My requests</Link></div>;
  const r = data.request;
  const t = r.technician;
  const techPos = live || (t && t.liveLocation);

  const cancel = async () => {
    setBusy(true);
    try { await api.put(`/requests/${id}/cancel`, { reason }); toast.success('Request cancelled'); setCancelOpen(false); reload(false); } catch (e) { toast.error(errMsg(e)); setCancelOpen(false); reload(); } finally { setBusy(false); }
  };
  const reschedule = async () => {
    setBusy(true);
    try { const { data: res } = await api.put(`/requests/${id}/reschedule`, rs); toast.success(res.message); setReschedOpen(false); reload(false); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  const unpaid = r.status === 'COMPLETED' && r.payment && ['PENDING', 'FAILED'].includes(r.payment.status);
  const needsReview = r.status === 'COMPLETED' && !r.rating;

  return (
    <div className="space-y-6">
      <Link to="/customer/requests" className="text-sm font-semibold text-brand-700 hover:underline">← My requests</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="text-sm text-ink-500">Request #{r.requestNumber}</div><h1 className="page-title">{r.serviceName}{r.packageName ? ` · ${r.packageName}` : ''}</h1></div>
        <div className="flex gap-2"><UrgencyBadge urgency={r.urgency} /><StatusBadge status={r.status} /></div>
      </div>

      {unpaid && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-50 p-4"><div><div className="font-bold text-amber-900">Your service is complete — bill {inr(r.payment.amount)}</div><div className="text-sm text-amber-800">Pay online or in cash.</div></div><Link to={`/customer/payment?request=${r._id}`} className="btn-accent">Pay now</Link></div>}
      {needsReview && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-50 p-4"><div className="font-bold text-brand-800">How was your technician?</div><Link to={`/customer/rating?request=${r._id}`} className="btn-primary">Rate technician</Link></div>}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-6">
          <section className="card-pad"><h2 className="mb-4 font-bold">Progress</h2><Timeline steps={r.timeline} />
            {r.searching && <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-ink-700"><Spinner className="mr-2 inline h-4 w-4 text-brand-600" />We are matching you with the best available technician.{r.nextAvailableSlot && <> Earliest possible slot: <b>{dateTime(r.nextAvailableSlot)}</b>.</>}</div>}
            {r.status === 'ASSIGNED' && <p className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">A technician was matched and has been asked to confirm.</p>}
            {r.estimatedStart && ['ASSIGNED', 'ACCEPTED'].includes(r.status) && <p className="mt-2 text-sm text-ink-500">Estimated start: {dateTime(r.estimatedStart)}</p>}
          </section>

          {r.status === 'CANCELLED' && <section className="card-pad text-sm"><h2 className="mb-2 font-bold">Cancelled</h2><p>{r.cancelledBy === 'ADMIN' ? 'Cancelled by FixFlow team.' : r.cancelledBy === 'SYSTEM' ? 'Cancelled by the system.' : 'You cancelled this request.'} {r.cancelReason}</p></section>}

          <section className="card-pad space-y-2">
            <h2 className="font-bold">Actions</h2>
            <div className="flex flex-wrap gap-2">
              {r.canReschedule && <button className="btn-outline" onClick={() => setReschedOpen(true)}>🗓️ Reschedule</button>}
              {r.canCancel && <button className="btn-danger" onClick={() => setCancelOpen(true)}>Cancel request</button>}
              {r.status === 'COMPLETED' && r.payment && r.payment.status === 'PAID' && <Link to={`/customer/invoice/${r._id}`} className="btn-outline">🧾 Invoice</Link>}
              {r.status === 'COMPLETED' && <Link to={`/customer/support?request=${r._id}`} className="btn-ghost">Report a problem</Link>}
            </div>
            {!r.canCancel && !['COMPLETED', 'CANCELLED'].includes(r.status) && <p className="text-xs text-ink-500">The service has started, so it can no longer be cancelled.</p>}
          </section>
        </div>

        <div className="space-y-6">
          {t && (
            <section className="card-pad">
              <h2 className="mb-3 font-bold">Your technician</h2>
              <div className="flex items-center gap-4">
                {t.profilePhoto ? <img src={t.profilePhoto} alt="" className="h-16 w-16 rounded-full object-cover" /> : <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-2xl font-bold text-brand-700">{t.name[0]}</div>}
                <div className="min-w-0">
                  <div className="text-lg font-bold">{t.name} {t.verified && <span className="badge bg-green-100 text-green-700">✔ Verified</span>}</div>
                  <Stars value={t.rating} count={t.ratingCount} size="text-sm" />
                  <div className="text-sm text-ink-500">{t.experience} yrs experience · {t.completedJobs} jobs</div>
                </div>
              </div>
              {t.phone && <a href={`tel:${t.phone}`} className="btn-outline mt-4 w-full">📞 Call {t.phone}</a>}
            </section>
          )}

          <section className="card-pad space-y-3 text-sm">
            <h2 className="font-bold">Details</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              <div><div className="text-xs text-ink-500">Scheduled</div>{dateTime(r.scheduledAt)} <span className="text-ink-500">({hhmmTo12(r.preferredTime)})</span></div>
              <div><div className="text-xs text-ink-500">Contact</div>{r.contactNumber}</div>
              <div className="sm:col-span-2"><div className="text-xs text-ink-500">Problem</div>{r.problemDescription}</div>
              <div className="sm:col-span-2"><div className="text-xs text-ink-500">Address</div>{r.location.address}</div>
              <div><div className="text-xs text-ink-500">{r.finalAmount != null ? 'Final bill' : 'Estimated price'}</div><b>{inr(r.finalAmount ?? r.price)}</b></div>
              {r.payment && <div><div className="text-xs text-ink-500">Payment</div><PayBadge status={r.payment.status} /> {r.payment.method && <span className="text-xs text-ink-500">{r.payment.method}</span>}</div>}
              {r.billNote && <div className="sm:col-span-2"><div className="text-xs text-ink-500">Technician note</div>{r.billNote}</div>}
            </div>
            <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Service only — any replacement part is arranged by you.</p>
          </section>

          <section className="card-pad"><h2 className="mb-3 font-bold">Location</h2><MapView latitude={r.location.latitude} longitude={r.location.longitude} technician={['ON_THE_WAY', 'ARRIVED', 'SERVICE_STARTED'].includes(r.status) ? techPos : undefined} showDirections={false} />
            {['ON_THE_WAY'].includes(r.status) && !techPos && <p className="mt-2 text-xs text-ink-500">Live technician position appears here once their app shares it.</p>}</section>
        </div>
      </div>

      <ConfirmModal open={cancelOpen} onClose={() => setCancelOpen(false)} danger busy={busy} title="Cancel this request?" message="The technician will be notified. You can cancel until the service starts." confirmLabel="Yes, cancel" onConfirm={cancel}>
        <div className="mt-3"><Field label="Reason (optional)"><input className="input" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} /></Field></div>
      </ConfirmModal>

      <Modal open={reschedOpen} onClose={() => setReschedOpen(false)} title="Reschedule"
        footer={<><button className="btn-outline" onClick={() => setReschedOpen(false)}>Back</button><button className="btn-primary" onClick={reschedule} disabled={busy}>{busy && <Spinner className="h-4 w-4" />} Confirm new slot</button></>}>
        <p className="mb-3 text-sm text-ink-500">We check your technician's availability again. If they are not free, we find another one for the new time.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="New date"><input className="input" type="date" min={todayStr()} value={rs.preferredDate} onChange={(e) => setRs({ ...rs, preferredDate: e.target.value })} /></Field>
          <Field label="New time"><input className="input" type="time" value={rs.preferredTime} onChange={(e) => setRs({ ...rs, preferredTime: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
