import { useState } from 'react';
import { Link } from 'react-router-dom';
import RequestCard from '../../components/RequestCard';
import { EmptyState, ErrorBox, Pagination, Skeleton, Tabs } from '../../components/ui';
import { useLiveRefresh } from '../../context/RealtimeContext';
import { useFetch } from '../../hooks/useAsync';

const TABS = [{ key: 'active', label: 'Active' }, { key: 'upcoming', label: 'Upcoming' }, { key: 'completed', label: 'Completed' }, { key: 'cancelled', label: 'Cancelled' }, { key: 'all', label: 'All' }];

export default function MyRequests() {
  const [group, setGroup] = useState('active');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useFetch('/requests/my', { group, page, limit: 10 });
  useLiveRefresh(reload);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="page-title">My requests</h1><Link to="/customer/request" className="btn-primary">New request</Link></div>
      <Tabs tabs={TABS} value={group} onChange={(k) => { setGroup(k); setPage(1); }} />
      <ErrorBox message={error} onRetry={reload} />
      {loading ? <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div> : data && data.requests.length ? (
        <><div className="grid gap-3 lg:grid-cols-2">{data.requests.map((r) => <RequestCard key={r._id} r={r} />)}</div><Pagination page={data.page} pages={data.pages} onChange={setPage} /></>
      ) : <EmptyState icon="📋" title={`No ${group === 'all' ? '' : group} requests`} text="Requests you create will show up here." action={<Link to="/customer/request" className="btn-primary">Book a Service</Link>} />}
    </div>
  );
}
