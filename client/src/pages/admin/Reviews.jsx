import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorBox, PageLoader, Pagination, StatCard, Stars } from '../../components/ui';
import { useLiveRefresh } from '../../context/RealtimeContext';
import { useFetch } from '../../hooks/useAsync';
import { dateTime } from '../../utils/format';

/** Every customer review, reached from the dashboard's "Average rating" card. */
export default function AdminReviews() {
  const [sp, setSp] = useSearchParams();
  const page = Math.max(1, Number(sp.get('page')) || 1);
  const { data, loading, error, reload } = useFetch('/admin/reviews', { page, limit: 20 });
  useLiveRefresh(reload);
  if (loading && !data) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="page-title">Customer reviews</h1><p className="text-ink-500">Every rating left by customers, newest first.</p></div>
        <Link to="/admin/dashboard" className="btn-outline">← Dashboard</Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard label="Average rating" value={data ? data.average.toFixed(2) : '—'} icon="⭐" tone="amber" />
        <StatCard label="Total reviews" value={data ? data.total : '—'} icon="💬" tone="brand" />
      </div>
      <ErrorBox message={error} onRetry={reload} />
      {data && data.reviews.length === 0 ? <EmptyState icon="⭐" title="No reviews yet" text="Reviews appear once customers rate completed jobs." /> : (
        <>
          <ul className="grid gap-3 md:grid-cols-2">
            {data && data.reviews.map((r) => (
              <li key={r._id} className="card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><Stars value={r.rating} showNumber={false} /><span className="text-xs text-ink-500">{dateTime(r.createdAt)}</span></div>
                {r.comment && <p className="mt-2 text-sm text-ink-700">“{r.comment}”</p>}
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-500">
                  <span>{r.customer}</span>
                  {r.technicianId ? <Link to={`/admin/technicians/${r.technicianId}`} className="font-semibold text-brand-700 hover:underline">{r.technician}</Link> : <span>{r.technician}</span>}
                  {r.service && <span>{r.service}</span>}
                  {r.requestNumber && <span>#{r.requestNumber}</span>}
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={data.page} pages={data.pages} onChange={(p) => setSp(p > 1 ? { page: String(p) } : {}, { replace: true })} />
        </>
      )}
    </div>
  );
}
