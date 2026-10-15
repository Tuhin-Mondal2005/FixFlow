import { useState } from 'react';
import { EmptyState, ErrorBox, Pagination, Skeleton } from '../../components/ui';
import { useFetch } from '../../hooks/useAsync';
import { dateTime } from '../../utils/format';

const ACTIONS = ['TECHNICIAN_APPROVED', 'TECHNICIAN_REJECTED', 'TECHNICIAN_CREATED', 'TECHNICIAN_UPDATED', 'TECHNICIAN_DELETED', 'TECHNICIAN_ACTIVATED', 'TECHNICIAN_DEACTIVATED', 'DOCUMENT_VIEWED', 'REQUEST_ASSIGNED', 'REQUEST_REASSIGNED', 'REQUEST_AUTO_ASSIGNED', 'REQUEST_CANCELLED', 'SERVICE_CREATED', 'SERVICE_UPDATED', 'SERVICE_DELETED', 'SERVICE_DEACTIVATED', 'SETTINGS_UPDATED', 'PAYMENT_REFUNDED', 'PAYOUT_SETTLED', 'SUPPORT_UPDATED'];

export default function AuditLog() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useFetch('/admin/audit-logs', { page, ...(action ? { action } : {}) });
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="page-title">Audit log</h1><p className="text-ink-500">Every admin action is recorded and cannot be edited.</p></div>
        <select className="input w-auto" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} aria-label="Action"><option value="">All actions</option>{ACTIONS.map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}</select></div>
      <ErrorBox message={error} onRetry={reload} />
      {loading ? <Skeleton className="h-64" /> : data && data.logs.length ? (
        <>
          <div className="table-wrap"><table className="table min-w-[760px]"><thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Summary</th><th>IP</th></tr></thead><tbody>{data.logs.map((l) => (
            <tr key={l._id}><td className="whitespace-nowrap text-xs">{dateTime(l.createdAt)}</td><td>{l.adminName}</td><td><span className="badge bg-slate-100 text-slate-700">{l.action.replace(/_/g, ' ')}</span></td><td className="max-w-[420px]">{l.summary}</td><td className="text-xs text-ink-500">{l.ip}</td></tr>))}</tbody></table></div>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      ) : <EmptyState icon="📜" title="No entries" text="Admin actions will be listed here." />}
    </div>
  );
}
