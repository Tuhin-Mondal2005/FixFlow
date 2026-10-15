import { Link } from 'react-router-dom';
import { Carousel } from '../../components/Carousel';
import JobCard from '../../components/JobCard';
import { AvailabilityBadge, EmptyState, ErrorBox, PageLoader, StatCard, VerifyBadge } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useLiveRefresh } from '../../context/RealtimeContext';
import { useFetch } from '../../hooks/useAsync';
import { useJobActions } from '../../hooks/useJobActions';
import { dateTime, inr } from '../../utils/format';

export default function TechDashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch('/technicians/dashboard');
  useLiveRefresh(reload);
  const actions = useJobActions(reload);

  if (loading) return <PageLoader />;
  if (error || !data) return <ErrorBox message={error || 'Could not load dashboard'} onRetry={reload} />;
  const { technician: t, stats, newRequests, activeJob, nextJob } = data;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Welcome, {user.name.split(' ')[0]} 👋</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">Status: <AvailabilityBadge status={t.availabilityStatus} /> <VerifyBadge status={t.verificationStatus} />
            {t.availabilityStatus === 'BUSY' && t.availableFrom && <span className="text-ink-500">· available after {dateTime(t.availableFrom)}</span>}
            <span className="text-ink-500">· {t.currentStatus}</span></div>
        </div>
        <Link to="/technician/availability" className="btn-outline">Change availability</Link>
      </div>

      {['OFFLINE', 'ON_LEAVE'].includes(t.availabilityStatus) && <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">You are <b>{t.availabilityStatus.replace('_', ' ')}</b> — you won't receive new jobs. <Link to="/technician/availability" className="font-semibold underline">Go available</Link></div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Today's jobs" value={stats.todaysJobs} accent tone="blue" />
        <StatCard label="Pending requests" value={stats.pendingRequests} accent tone="amber" />
        <StatCard label="Completed jobs" value={stats.completedJobs} accent tone="green" />
        <StatCard label="Today's earnings" value={inr(stats.todaysEarnings)} accent tone="purple" />
        <StatCard label="Average rating" value={stats.rating ? stats.rating.toFixed(1) : '—'} accent tone="amber" hint={stats.ratingCount ? `${stats.ratingCount} reviews` : 'No reviews yet'} />
      </div>

      <section>
        <h2 className="section-title mb-3">New requests {newRequests.length > 0 && <span className="badge bg-red-100 text-red-700">{newRequests.length}</span>}</h2>
        {newRequests.length === 0 ? <EmptyState icon="🔔" title="No new requests" text="New job offers appear here instantly. Keep your status set to Available." /> : (
          <Carousel label="New requests" itemClass="w-[88%] sm:w-[48%] lg:w-[32%]">
            {newRequests.map((j) => <JobCard key={j._id} job={j} onAccept={actions.accept} onReject={actions.reject} busyId={actions.busyId} />)}
          </Carousel>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="section-title mb-3">Active job</h2>
          {activeJob ? <JobCard job={activeJob} /> : <EmptyState icon="🧰" title="No active job" text="Accepted jobs that are in progress show here." />}
        </div>
        <div>
          <h2 className="section-title mb-3">Next accepted job</h2>
          {nextJob ? <JobCard job={nextJob} /> : <EmptyState icon="🗓️" title="Nothing scheduled" />}
        </div>
      </section>
      {actions.modal}
    </div>
  );
}
