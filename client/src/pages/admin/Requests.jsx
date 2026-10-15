import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorBox, Pagination, Skeleton, StatusBadge, UrgencyBadge } from '../../components/ui';
import { useLiveRefresh } from '../../context/RealtimeContext';
import { useFetch } from '../../hooks/useAsync';
import { dateTime, inr } from '../../utils/format';

const STATUSES = ['SUBMITTED', 'ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'SERVICE_STARTED', 'COMPLETED', 'CANCELLED'];
const FILTER_KEYS = ['q', 'status', 'urgency', 'serviceId', 'range', 'date'];
// One date control: a preset, or a single picked day. Replaces the two separate from/to boxes.
const RANGES = { any: 'Any date', today: 'Today', last7: 'Last 7 days', next7: 'Next 7 days', last30: 'Last 30 days', date: 'Pick a date' };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysFromToday = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
function rangeToDates(range, date) {
  const today = iso(new Date());
  if (range === 'today') return { from: today, to: today };
  if (range === 'last7') return { from: daysFromToday(-7), to: today };
  if (range === 'next7') return { from: today, to: daysFromToday(7) };
  if (range === 'last30') return { from: daysFromToday(-30), to: today };
  if (range === 'date' && date) return { from: date, to: date };
  return {};
}

export default function AdminRequests() {
  // Filters live in the URL so dashboard cards can link straight to a filtered list (and Back works).
  const [sp, setSp] = useSearchParams();
  const f = Object.fromEntries(FILTER_KEYS.map((k) => [k, sp.get(k) || '']));
  const label = sp.get('label') || '';
  const page = Math.max(1, Number(sp.get('page')) || 1);
  const { from, to } = rangeToDates(f.range, f.date);
  const { range, date, ...rest } = f; // range/date only exist in the URL; the API gets from/to
  const params = { page, limit: 20, ...Object.fromEntries(Object.entries(rest).filter(([, v]) => v)), ...(from ? { from, to } : {}) };
  const { data, loading, error, reload } = useFetch('/admin/requests', params);
  const services = useFetch('/admin/services');
  useLiveRefresh(reload);

  const commit = (changes, { dropLabel = true } = {}) => {
    const n = new URLSearchParams(sp);
    Object.entries(changes).forEach(([k, v]) => (v ? n.set(k, String(v)) : n.delete(k)));
    if (dropLabel) n.delete('label'); // a manual change means the dashboard label no longer applies
    setSp(n, { replace: true });
  };
  const setFilter = (k) => (e) => commit({ [k]: e.target.value, page: '' });
  const setRange = (e) => commit({ range: e.target.value, date: e.target.value === 'date' ? f.date : '', page: '' });
  const setPage = (p) => commit({ page: p > 1 ? p : '' }, { dropLabel: false });
  const clearAll = () => setSp(new URLSearchParams(), { replace: true });
  const showingFilters = Boolean(label) || Object.values(f).some(Boolean);

  return (
    <div className="space-y-5">
      <h1 className="page-title">Service requests</h1>
      <div className="card grid min-w-0 grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-6">
        <input className="input min-w-0 sm:col-span-2 xl:col-span-2" placeholder="Search #, customer, service, address…" value={f.q} onChange={setFilter('q')} aria-label="Search" />
        <select className="input min-w-0" value={f.status} onChange={setFilter('status')} aria-label="Status"><option value="">Any status</option>{STATUSES.map((st) => <option key={st} value={st}>{st.replace('_', ' ')}</option>)}</select>
        <select className="input min-w-0" value={f.urgency} onChange={setFilter('urgency')} aria-label="Urgency"><option value="">Any urgency</option><option>LOW</option><option>MEDIUM</option><option>HIGH</option></select>
        <select className="input min-w-0" value={f.serviceId} onChange={setFilter('serviceId')} aria-label="Service"><option value="">Any service</option>{(services.data ? services.data.services : []).map((sv) => <option key={sv._id} value={sv._id}>{sv.name}</option>)}</select>
        <select className="input min-w-0" value={f.range || 'any'} onChange={setRange} aria-label="Scheduled date">{Object.entries(RANGES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        {f.range === 'date' && <input className="input min-w-0 sm:col-span-2 xl:col-span-6 xl:max-w-xs" type="date" value={f.date} onChange={setFilter('date')} aria-label="Pick a date" />}
      </div>

      {showingFilters && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm">
          <span>Showing <b>{label || 'filtered requests'}</b>{data && ` · ${data.total} result${data.total === 1 ? '' : 's'}`}</span>
          <button className="btn-outline btn-sm" onClick={clearAll}>Clear filters</button>
        </div>
      )}

      <ErrorBox message={error} onRetry={reload} />
      {loading ? <Skeleton className="h-64" /> : data && data.requests.length ? (
        <>
          {/* phones: one card per request */}
          <ul className="space-y-3 xl:hidden">
            {data.requests.map((r) => (
              <li key={r._id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><div className="font-semibold">#{r.requestNumber} · {r.serviceName}</div><div className="truncate text-xs text-ink-500">{r.address}</div></div>
                  <StatusBadge status={r.status} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div><dt className="text-xs text-ink-500">Customer</dt><dd className="truncate">{r.customer ? r.customer.name : '—'}</dd></div>
                  <div><dt className="text-xs text-ink-500">Scheduled</dt><dd>{dateTime(r.scheduledAt)}</dd></div>
                  <div><dt className="text-xs text-ink-500">Technician</dt><dd className="truncate">{r.technician ? r.technician.name : '—'}{r.needsAdmin && <span className="badge ml-1 bg-red-100 text-red-700">Needs admin</span>}</dd></div>
                  <div><dt className="text-xs text-ink-500">Amount</dt><dd>{inr(r.finalAmount != null ? r.finalAmount : r.price)}</dd></div>
                </dl>
                <div className="mt-3 flex items-center justify-between gap-2"><UrgencyBadge urgency={r.urgency} /><Link className="btn-outline btn-sm" to={`/admin/requests/${r._id}`}>Open</Link></div>
              </li>
            ))}
          </ul>

          {/* tablet / desktop: table */}
          <div className="table-wrap hidden xl:block">
            <table className="table min-w-[960px]">
              <thead><tr><th>#</th><th>Service</th><th>Customer</th><th>Scheduled</th><th>Urgency</th><th>Technician</th><th>Amount</th><th>Status</th><th /></tr></thead>
              <tbody>{data.requests.map((r) => (
                <tr key={r._id}>
                  <td className="font-semibold">{r.requestNumber}</td>
                  <td>{r.serviceName}<div className="line-clamp-1 max-w-[220px] text-xs text-ink-500">{r.address}</div></td>
                  <td>{r.customer ? r.customer.name : '—'}<div className="text-xs text-ink-500">{r.customer && r.customer.phone}</div></td>
                  <td>{dateTime(r.scheduledAt)}</td>
                  <td><UrgencyBadge urgency={r.urgency} /></td>
                  <td>{r.technician ? r.technician.name : <span className="text-ink-500">—</span>}{r.needsAdmin && <span className="badge ml-1 bg-red-100 text-red-700">Needs admin</span>}</td>
                  <td>{inr(r.finalAmount != null ? r.finalAmount : r.price)}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="text-right"><Link className="font-semibold text-brand-700 hover:underline" to={`/admin/requests/${r._id}`}>Open</Link></td>
                </tr>))}</tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
          <p className="text-xs text-ink-500">{data.total} requests. Emergency requests are listed first.</p>
        </>
      ) : <EmptyState icon="🗂️" title="No requests match" text={showingFilters ? 'Nothing matches this view yet.' : 'No requests yet.'} action={showingFilters ? <button className="btn-outline" onClick={clearAll}>Clear filters</button> : null} />}
    </div>
  );
}
