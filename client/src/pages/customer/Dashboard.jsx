import { Link } from 'react-router-dom';
import { Carousel } from '../../components/Carousel';
import RequestCard from '../../components/RequestCard';
import ServiceCard from '../../components/ServiceCard';
import { EmptyState, ErrorBox, Skeleton, StatCard } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useLiveRefresh } from '../../context/RealtimeContext';
import { useFetch } from '../../hooks/useAsync';
import { inr } from '../../utils/format';

export default function CustomerDashboard() {
  const { user } = useAuth();
  const summary = useFetch('/requests/summary');
  const active = useFetch('/requests/my', { group: 'active', limit: 6 });
  const recent = useFetch('/requests/my', { group: 'history', limit: 3 });
  const services = useFetch('/services');
  useLiveRefresh(() => { summary.reload(); active.reload(); recent.reload(); });

  const s = summary.data ? summary.data.summary : null;
  const recommended = services.data ? services.data.services.slice().sort((a, b) => (b.ratingCount || 0) - (a.ratingCount || 0)).slice(0, 8) : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="page-title">Welcome, {user.name.split(' ')[0]} 👋</h1><p className="text-ink-500">What needs fixing today?</p></div>
        <Link to="/customer/request" className="btn-primary btn-lg">Book a Service</Link>
      </div>

      <ErrorBox message={summary.error} onRetry={summary.reload} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {!s ? [...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />) : (
          <>
            <StatCard label="Active requests" value={s.active} accent tone="amber" />
            <StatCard label="Upcoming services" value={s.upcoming} accent tone="blue" />
            <StatCard label="Completed" value={s.completed} accent tone="green" />
            <StatCard label="Cancelled" value={s.cancelled} accent tone="red" />
            <Link to="/customer/payment" className="block"><StatCard label="Payment history" value={inr(s.totalPaid)} accent tone="purple" hint={s.unpaidBills ? `${s.unpaidBills} bill(s) to pay` : 'All settled'} /></Link>
          </>
        )}
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="section-title">Active requests</h2><Link to="/customer/requests" className="text-sm font-semibold text-brand-700 hover:underline">View all</Link></div>
        {active.loading ? <Skeleton className="h-28" /> : active.data && active.data.requests.length ? (
          <div className="grid gap-3 lg:grid-cols-2">{active.data.requests.map((r) => <RequestCard key={r._id} r={r} />)}</div>
        ) : <EmptyState icon="🧰" title="No active requests" text="Book a service and we'll find the best technician near you." action={<Link to="/customer/request" className="btn-primary">Book a Service</Link>} />}
      </section>

      <section>
        <h2 className="section-title mb-3">Recommended services</h2>
        {services.loading ? <Skeleton className="h-64" /> : <Carousel label="Recommended services">{recommended.map((sv) => <ServiceCard key={sv._id} service={sv} />)}</Carousel>}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="section-title">Service history</h2><Link to="/customer/history" className="text-sm font-semibold text-brand-700 hover:underline">Full history</Link></div>
        {recent.data && recent.data.requests.length ? <div className="grid gap-3 lg:grid-cols-3">{recent.data.requests.map((r) => <RequestCard key={r._id} r={r} />)}</div> : !recent.loading && <p className="text-sm text-ink-500">Your completed and cancelled services will appear here.</p>}
      </section>
    </div>
  );
}
