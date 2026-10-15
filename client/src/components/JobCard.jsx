import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dateTime, hhmmTo12, inr } from '../utils/format';
import { Spinner, StatusBadge, UrgencyBadge } from './ui';

/** mm:ss until the offer expires; goes red in the last minute. */
export function Countdown({ to }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const left = Math.max(0, Math.floor((new Date(to).getTime() - now) / 1000));
  const m = String(Math.floor(left / 60)).padStart(2, '0');
  const s = String(left % 60).padStart(2, '0');
  return <span className={`font-mono font-bold ${left < 60 ? 'text-red-600' : 'text-ink-700'}`} aria-label="Time left to respond">⏳ {m}:{s}</span>;
}

/** Job / request card for technicians. Shows Accept / Reject for new offers (Section 24). */
export default function JobCard({ job, onAccept, onReject, busyId }) {
  const isNew = job.status === 'ASSIGNED';
  const busy = busyId === job._id;
  return (
    <div className={`card flex h-full flex-col p-4 ${job.urgency === 'HIGH' && isNew ? 'ring-2 ring-red-300' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div><div className="text-xs font-semibold text-ink-500">Request #{job.requestNumber}</div><div className="text-base font-bold">{job.serviceName}{job.packageName ? ` · ${job.packageName}` : ''}</div></div>
        <div className="flex flex-col items-end gap-1"><UrgencyBadge urgency={job.urgency} />{!isNew && <StatusBadge status={job.status} />}</div>
      </div>
      <dl className="mt-3 space-y-1 text-sm text-ink-700">
        <div>👤 {job.customer && job.customer.name}</div>
        <div className="truncate">📍 {job.location && job.location.address}{job.distanceKm !== undefined && <span className="text-ink-500"> · {job.distanceKm} km away</span>}</div>
        <div>🗓️ {dateTime(job.scheduledAt)} <span className="text-ink-500">({hhmmTo12(job.preferredTime)})</span></div>
        <div>💰 {inr(job.finalAmount ?? job.price)}</div>
        {job.problemDescription && <div className="line-clamp-2 text-ink-500">“{job.problemDescription}”</div>}
      </dl>
      {isNew && job.expiresAt && <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm">Respond within <Countdown to={job.expiresAt} /></div>}
      <div className="mt-auto flex gap-2 pt-4">
        {isNew ? (
          <>
            <button className="btn-primary flex-1" disabled={busy} onClick={() => onAccept(job)}>{busy ? <Spinner className="h-4 w-4" /> : '✔'} Accept</button>
            <button className="btn-outline flex-1" disabled={busy} onClick={() => onReject(job)}>✕ Reject</button>
          </>
        ) : <Link to={`/technician/jobs/${job._id}`} className="btn-outline w-full">Open job</Link>}
      </div>
    </div>
  );
}
