import { Link } from 'react-router-dom';
import { dateTime, inr } from '../utils/format';
import { PayBadge, StatusBadge, UrgencyBadge } from './ui';

/** Compact row/card for a customer's request. */
export default function RequestCard({ r }) {
  return (
    <Link to={`/customer/request/${r._id}`} className="card block p-4 transition hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-ink-500">Request #{r.requestNumber}</div>
          <div className="text-base font-bold">{r.serviceName}{r.packageName ? ` · ${r.packageName}` : ''}</div>
        </div>
        <div className="flex flex-wrap gap-1.5"><UrgencyBadge urgency={r.urgency} /><StatusBadge status={r.status} /></div>
      </div>
      <div className="mt-3 grid gap-1 text-sm text-ink-700 sm:grid-cols-2">
        <div>🗓️ {dateTime(r.scheduledAt)}</div>
        <div className="truncate">📍 {r.location && r.location.address}</div>
        <div>👷 {r.technician ? r.technician.name : r.status === 'SUBMITTED' ? 'Finding a technician…' : '—'}</div>
        <div>💰 {inr(r.finalAmount ?? r.price)} {r.status === 'COMPLETED' && <PayBadge status={r.paymentStatus} />}</div>
      </div>
    </Link>
  );
}
