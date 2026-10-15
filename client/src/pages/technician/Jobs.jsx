import { useState } from 'react';
import JobCard from '../../components/JobCard';
import { EmptyState, ErrorBox, Pagination, Skeleton, Tabs } from '../../components/ui';
import { useLiveRefresh } from '../../context/RealtimeContext';
import { useFetch } from '../../hooks/useAsync';
import { useJobActions } from '../../hooks/useJobActions';

const TABS = [{ key: 'pending', label: 'New requests' }, { key: 'active', label: 'Accepted' }, { key: 'today', label: 'Today' }, { key: 'completed', label: 'Completed' }, { key: 'cancelled', label: 'Cancelled' }, { key: 'all', label: 'All' }];

export default function TechJobs() {
  const [group, setGroup] = useState('pending');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useFetch('/technicians/jobs', { group, page, limit: 12 });
  useLiveRefresh(reload);
  const actions = useJobActions(reload);

  return (
    <div className="space-y-5">
      <h1 className="page-title">Jobs</h1>
      <Tabs tabs={TABS} value={group} onChange={(k) => { setGroup(k); setPage(1); }} />
      <ErrorBox message={error} onRetry={reload} />
      {loading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-56" />)}</div> : data && data.jobs.length ? (
        <><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.jobs.map((j) => <JobCard key={j._id} job={j} onAccept={actions.accept} onReject={actions.reject} busyId={actions.busyId} />)}</div><Pagination page={data.page} pages={data.pages} onChange={setPage} /></>
      ) : <EmptyState icon="🧰" title="No jobs here" text="Jobs matching this filter will appear here." />}
      {actions.modal}
    </div>
  );
}
