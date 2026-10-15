import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapView } from '../../components/Maps';
import Timeline from '../../components/Timeline';
import { ConfirmModal, ErrorBox, Field, Modal, PageLoader, PayBadge, Spinner, StatusBadge, Stars, UrgencyBadge } from '../../components/ui';
import { useLiveRefresh } from '../../context/RealtimeContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useAsync';
import api, { errMsg } from '../../services/api';
import { dateTime, inr } from '../../utils/format';

const FACTORS = ['skill', 'availability', 'location', 'workload', 'rating', 'experience'];

export default function AdminRequestDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(`/admin/requests/${id}`);
  useLiveRefresh(reload);
  const [picker, setPicker] = useState(null); // 'assign' | 'reassign'
  const [cancel, setCancel] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');

  if (loading) return <PageLoader />;
  if (error || !data) return <div className="space-y-3"><ErrorBox message={error || 'Not found'} onRetry={reload} /><Link to="/admin/requests" className="btn-outline">← Requests</Link></div>;
  const r = data.request;
  const open = !['COMPLETED', 'CANCELLED'].includes(r.status);
  const a = r.assignment || {};

  const autoAssign = async () => {
    setBusy('auto');
    try { const { data: d } = await api.put(`/admin/requests/${r._id}/auto-assign`); (d.assigned ? toast.success : toast.info)(d.message); reload(false); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(''); }
  };
  const doCancel = async () => {
    if (reason.trim().length < 3) return toast.error('Enter a reason (at least 3 characters)');
    setBusy('cancel');
    try { await api.put(`/admin/requests/${r._id}/cancel`, { reason }); toast.success('Request cancelled'); setCancel(false); setReason(''); reload(false); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(''); }
  };

  return (
    <div className="space-y-6">
      <Link to="/admin/requests" className="text-sm font-semibold text-brand-700 hover:underline">← Requests</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Request #{r.requestNumber} · {r.serviceName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2"><StatusBadge status={r.status} /><UrgencyBadge urgency={r.urgency} />{r.paymentStatus && <PayBadge status={r.paymentStatus} />}{a.needsAdmin && <span className="badge bg-red-100 text-red-700">Needs admin attention</span>}</div>
        </div>
        {open && (
          <div className="flex flex-wrap gap-2">
            {r.status === 'SUBMITTED' && <button className="btn-outline" disabled={busy === 'auto'} onClick={autoAssign}>{busy === 'auto' && <Spinner className="h-4 w-4" />}⚙️ Run auto-assign</button>}
            {r.status === 'SUBMITTED' ? <button className="btn-primary" onClick={() => setPicker('assign')}>👤 Assign manually</button> : !['SERVICE_STARTED'].includes(r.status) && <button className="btn-primary" onClick={() => setPicker('reassign')}>🔁 Reassign</button>}
            <button className="btn-danger" onClick={() => setCancel(true)}>Cancel request</button>
          </div>
        )}
      </div>

      {a.needsAdmin && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          No technician could be assigned automatically{a.attempts ? ` after ${a.attempts} attempt(s)` : ''}.{a.nextAvailableSlot && <> Next available slot: <b>{dateTime(a.nextAvailableSlot)}</b>.</>} Assign one manually or contact the customer to reschedule.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card-pad text-sm">
            <h2 className="mb-3 font-bold">Details</h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div><dt className="text-xs text-ink-500">Customer</dt><dd>{r.customerId ? `${r.customerId.name} · ${r.customerId.phone}` : '—'}</dd></div>
              <div><dt className="text-xs text-ink-500">Scheduled</dt><dd>{dateTime(r.scheduledAt)}</dd></div>
              <div><dt className="text-xs text-ink-500">Package</dt><dd>{r.packageName || 'Standard'}</dd></div>
              <div><dt className="text-xs text-ink-500">Price</dt><dd>{inr(r.finalAmount != null ? r.finalAmount : r.price)}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-ink-500">Address</dt><dd>{r.location && r.location.address}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-ink-500">Problem description</dt><dd className="whitespace-pre-wrap">{r.problemDescription || '—'}</dd></div>
              {r.cancelReason && <div className="sm:col-span-2"><dt className="text-xs text-ink-500">Cancelled by {r.cancelledBy}</dt><dd className="text-red-700">{r.cancelReason}</dd></div>}
            </dl>
          </section>

          {r.location && r.location.latitude != null && <section className="card-pad space-y-3"><h2 className="font-bold">Customer location</h2><MapView latitude={r.location.latitude} longitude={r.location.longitude} label="Customer" /></section>}

          {a.attempts && a.attempts.length > 0 && (
            <section className="card-pad text-sm">
              <h2 className="mb-3 font-bold">Assignment history</h2>
              <ul className="space-y-2">{a.attempts.map((t, i) => <li key={i} className="flex flex-wrap justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"><span><b>{t.technicianName || 'Technician'}</b> — {String(t.outcome || 'PENDING').replace('_', ' ')}{t.reason ? ` (${t.reason})` : ''}</span><span className="text-xs text-ink-500">{t.at && dateTime(t.at)}{t.score != null ? ` · score ${t.score}` : ''}{t.mode ? ` · ${t.mode}` : ''}</span></li>)}</ul>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section className="card-pad"><h2 className="mb-3 font-bold">Progress</h2><Timeline steps={r.timeline} /></section>
          <section className="card-pad text-sm space-y-1">
            <h2 className="mb-2 font-bold">Technician</h2>
            {r.technician ? <><Link className="font-semibold text-brand-700 hover:underline" to={`/admin/technicians/${r.technician._id}`}>{r.technician.name}</Link><div>{r.technician.phone}</div><Stars value={r.technician.rating} showNumber count={r.technician.ratingCount} /><div className="text-ink-500">{r.technician.experience} yrs · {r.technician.currentJobs} active jobs</div></> : <p className="text-ink-500">Not assigned yet.</p>}
          </section>
          {r.payment && <section className="card-pad text-sm space-y-1"><h2 className="mb-2 font-bold">Payment</h2><div className="flex justify-between"><span>Amount</span><b>{inr(r.payment.amount)}</b></div><div className="flex justify-between"><span>Method</span><span>{r.payment.method}</span></div><div className="flex justify-between"><span>Commission ({r.payment.commissionRate}%)</span><span>{inr(r.payment.commission)}</span></div><div className="flex justify-between"><span>Technician earning</span><span>{inr(r.payment.technicianEarning)}</span></div><PayBadge status={r.payment.status} /></section>}
          {r.rating && <section className="card-pad text-sm"><h2 className="mb-2 font-bold">Customer rating</h2><Stars value={r.rating.rating} />{r.rating.comment && <p className="mt-1">“{r.rating.comment}”</p>}</section>}
          {r.tickets && r.tickets.length > 0 && <section className="card-pad text-sm"><h2 className="mb-2 font-bold">Support tickets</h2>{r.tickets.map((t) => <div key={t._id}>#{t.ticketNumber} · {t.subject} <span className="badge bg-slate-100">{t.status}</span></div>)}<Link to="/admin/support" className="mt-2 inline-block font-semibold text-brand-700 hover:underline">Open support →</Link></section>}
        </div>
      </div>

      {picker && <CandidatePicker request={r} mode={picker} onClose={() => setPicker(null)} onDone={() => { setPicker(null); reload(false); }} />}
      <ConfirmModal open={cancel} onClose={() => setCancel(false)} danger busy={busy === 'cancel'} title="Cancel this request?" message="The customer and technician will be notified." confirmLabel="Cancel request" onConfirm={doCancel}>
        <div className="mt-3"><Field label="Reason" required><input className="input" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} /></Field></div>
      </ConfirmModal>
    </div>
  );
}

/** Shows the engine's ranked candidates (with score breakdown) and why others were filtered out. */
function CandidatePicker({ request, mode, onClose, onDone }) {
  const toast = useToast();
  const { data, loading, error } = useFetch(`/admin/requests/${request._id}/candidates`);
  const [busy, setBusy] = useState('');
  const [reason, setReason] = useState('');
  const [force, setForce] = useState(null); // { technicianId, name, warnings }

  const submit = async (technicianId, forceFlag = false) => {
    setBusy(technicianId || 'auto');
    try {
      const body = mode === 'assign' ? { technicianId, force: forceFlag } : { technicianId, force: forceFlag, reason: reason || undefined };
      const { data: d } = await api.put(`/admin/requests/${request._id}/${mode}`, body);
      toast.success(d.message || 'Done'); onDone();
    } catch (e) {
      const det = e.response && e.response.data && e.response.data.details;
      if (e.response && e.response.status === 409 && det && det.code === 'NEEDS_FORCE') setForce({ technicianId, name: (data && data.ranked.concat([]).find((c) => c.technicianId === technicianId) || {}).name || 'This technician', warnings: det.warnings || [] });
      else toast.error(errMsg(e));
    } finally { setBusy(''); }
  };

  return (
    <Modal open onClose={onClose} title={mode === 'assign' ? 'Assign technician' : 'Reassign request'} wide
      footer={<><button className="btn-outline" onClick={onClose}>Close</button>{mode === 'reassign' && <button className="btn-primary" disabled={Boolean(busy)} onClick={() => submit(undefined)}>{busy === 'auto' && <Spinner className="h-4 w-4" />}⚙️ Let the engine pick</button>}</>}>
      {loading && <PageLoader label="Scoring technicians…" />}
      <ErrorBox message={error} />
      {mode === 'reassign' && <div className="mb-4"><Field label="Reason (optional)"><input className="input" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer asked for a different technician" /></Field></div>}
      {data && (
        <div className="space-y-5">
          <div>
            <h3 className="mb-2 text-sm font-bold">Eligible technicians (best first)</h3>
            {data.ranked.length === 0 ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Nobody is eligible right now.{data.nextAvailableSlot && <> Next available slot: <b>{dateTime(data.nextAvailableSlot)}</b>.</>}</p> : (
              <ul className="space-y-2">{data.ranked.map((c, i) => (
                <li key={c.technicianId} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div><b>{i + 1}. {c.name}</b> <span className="ml-1 text-sm text-ink-500">{c.distanceKm} km · {c.activeJobs} active job(s)</span></div>
                    <div className="flex items-center gap-3"><span className="badge bg-brand-50 text-brand-700">Score {c.score}</span><button className="btn-primary btn-sm" disabled={Boolean(busy)} onClick={() => submit(c.technicianId)}>{busy === c.technicianId && <Spinner className="h-4 w-4" />}Select</button></div>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-x-4 gap-y-1 text-xs text-ink-500 sm:grid-cols-6">{FACTORS.map((k) => <span key={k}>{k}: <b className="text-ink-700">{Math.round((c.factors && c.factors[k]) || 0)}</b></span>)}</div>
                </li>))}</ul>
            )}
          </div>
          {data.rejected.length > 0 && (
            <details className="text-sm"><summary className="cursor-pointer font-semibold">Filtered out ({data.rejected.length})</summary>
              <ul className="mt-2 space-y-1">{data.rejected.map((c, i) => <li key={i} className="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-1.5"><span>{c.name}</span><span className="text-ink-500">{c.reason}</span></li>)}</ul>
            </details>
          )}
        </div>
      )}
      <ConfirmModal open={Boolean(force)} onClose={() => setForce(null)} danger busy={Boolean(busy)} title="Override warnings?" message={force ? `${force.name} has: ${force.warnings.join('; ') || 'conflicts'}. Assign anyway?` : ''} confirmLabel="Assign anyway" onConfirm={() => { const f = force; setForce(null); submit(f.technicianId, true); }} />
    </Modal>
  );
}
