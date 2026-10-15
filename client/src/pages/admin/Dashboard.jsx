import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ChartCard, { INK, SERIES, axisProps, gridProps } from '../../components/ChartCard';
import { EmptyState, ErrorBox, PageLoader, Skeleton, StatCard, UrgencyBadge } from '../../components/ui';
import { useLiveRefresh } from '../../context/RealtimeContext';
import { useFetch } from '../../hooks/useAsync';
import { CATEGORY_LABEL, dateTime, inr } from '../../utils/format';

const tip = { contentStyle: { borderRadius: 12, border: `1px solid ${INK.grid}`, fontSize: 12 }, cursor: { fill: 'rgba(15,23,42,.04)' } };

const OPEN_STATUSES = 'SUBMITTED,ASSIGNED,ACCEPTED,ON_THE_WAY,ARRIVED,SERVICE_STARTED';
const link = (path, params) => `${path}?${new URLSearchParams(params).toString()}`;
// Every dashboard card opens the list that matches its number (same filters the server counts with).
const DRILL = {
  totalRequests: link('/admin/requests', { label: 'All requests' }),
  pendingRequests: link('/admin/requests', { status: 'SUBMITTED', label: 'Pending requests' }),
  completedRequests: link('/admin/requests', { status: 'COMPLETED', label: 'Completed requests' }),
  cancelledRequests: link('/admin/requests', { status: 'CANCELLED', label: 'Cancelled requests' }),
  totalTechnicians: link('/admin/technicians', { verificationStatus: 'APPROVED', label: 'All approved technicians' }),
  availableTechnicians: link('/admin/technicians', { verificationStatus: 'APPROVED', availabilityStatus: 'AVAILABLE', isActive: 'true', label: 'Available technicians' }),
  busyTechnicians: link('/admin/technicians', { verificationStatus: 'APPROVED', availabilityStatus: 'BUSY', isActive: 'true', label: 'Busy technicians' }),
  emergencyRequests: link('/admin/requests', { urgency: 'HIGH', status: OPEN_STATUSES, label: 'Emergency requests (open, HIGH priority)' }),
  activeJobs: link('/admin/requests', { status: 'ACCEPTED,ON_THE_WAY,ARRIVED,SERVICE_STARTED', label: 'Active jobs' }),
  pendingVerification: '/admin/technicians/pending',
  averageRating: '/admin/reviews',
  platformCommission: link('/admin/payments', { status: 'PAID' }),
};

export default function AdminDashboard() {
  const { data, loading, error, reload } = useFetch('/admin/dashboard');
  useLiveRefresh(reload);
  if (loading) return <PageLoader />;
  if (error || !data) return <ErrorBox message={error || 'Could not load dashboard'} onRetry={reload} />;
  const { stats: s, charts: c, needsAttention } = data;
  const byCat = c.requestsByCategory.map((x) => ({ name: (CATEGORY_LABEL[x.category] || x.category).replace(' Services', ''), count: x.count }));
  const cvc = c.completedVsCancelled.filter((x) => x.value > 0);
  const total = cvc.reduce((a, b) => a + b.value, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="page-title">Dashboard</h1><p className="text-ink-500">Live overview of requests, technicians and revenue.</p></div>
        <div className="flex gap-2"><Link to="/admin/technicians/pending" className="btn-outline">🛡️ Verification {s.pendingVerification > 0 && <span className="badge bg-red-100 text-red-700">{s.pendingVerification}</span>}</Link><Link to="/admin/requests" className="btn-primary">All requests</Link></div>
      </div>

      {needsAttention.length > 0 && (
        <section className="rounded-2xl border-2 border-red-200 bg-red-50 p-4">
          <h2 className="mb-2 font-bold text-red-800">⚠️ Needs manual assignment ({needsAttention.length})</h2>
          <ul className="space-y-2">{needsAttention.map((r) => (
            <li key={r._id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-3 text-sm">
              <span><b>#{r.requestNumber}</b> {r.serviceName} <UrgencyBadge urgency={r.urgency} />{r.assignment && r.assignment.nextAvailableSlot && <span className="ml-2 text-ink-500">next slot {dateTime(r.assignment.nextAvailableSlot)}</span>}</span>
              <Link className="btn-primary btn-sm" to={`/admin/requests/${r._id}`}>Assign</Link>
            </li>))}</ul>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
        <StatCard label="Total requests" value={s.totalRequests} accent tone="brand" to={DRILL.totalRequests} />
        <StatCard label="Pending requests" value={s.pendingRequests} accent tone="amber" hint={`${s.assignedAwaitingResponse} awaiting technician`} to={DRILL.pendingRequests} />
        <StatCard label="Completed" value={s.completedRequests} accent tone="green" to={DRILL.completedRequests} />
        <StatCard label="Cancelled" value={s.cancelledRequests} accent tone="red" to={DRILL.cancelledRequests} />
        <StatCard label="Total technicians" value={s.totalTechnicians} accent tone="blue" to={DRILL.totalTechnicians} />
        <StatCard label="Available technicians" value={s.availableTechnicians} accent tone="green" to={DRILL.availableTechnicians} />
        <StatCard label="Busy technicians" value={s.busyTechnicians} accent tone="amber" to={DRILL.busyTechnicians} />
        <StatCard label="Emergency requests" value={s.emergencyRequests} accent tone="red" hint="open, HIGH priority" to={DRILL.emergencyRequests} />
        <StatCard label="Active jobs" value={s.activeJobs} accent tone="purple" to={DRILL.activeJobs} />
        <StatCard label="Pending verification" value={s.pendingVerification} accent tone="amber" to={DRILL.pendingVerification} />
        <StatCard label="Average rating" value={s.averageRating ? s.averageRating.toFixed(2) : '—'} accent tone="amber" hint={`${s.reviewCount} reviews`} to={DRILL.averageRating} />
        <StatCard label="Platform commission" value={inr(s.totalCommission)} accent tone="green" hint={`of ${inr(s.totalRevenue)} revenue`} to={DRILL.platformCommission} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Requests by service category" columns={[{ key: 'name', label: 'Category' }, { key: 'count', label: 'Requests' }]} rows={byCat}>
          <ResponsiveContainer><BarChart data={byCat} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}><CartesianGrid {...gridProps} /><XAxis dataKey="name" {...axisProps} /><YAxis allowDecimals={false} {...axisProps} /><Tooltip {...tip} /><Bar dataKey="count" name="Requests" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={44} /></BarChart></ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Completed vs cancelled" subtitle={total ? `${total} finished requests` : ''} columns={[{ key: 'name', label: 'Outcome' }, { key: 'value', label: 'Requests' }]} rows={cvc} empty="No completed or cancelled requests yet">
          <ResponsiveContainer><PieChart><Pie data={cvc} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="#fff" strokeWidth={2} label={({ name, value }) => `${name} ${value}`} labelLine={false}>{cvc.map((x, i) => <Cell key={x.name} fill={SERIES[i]} />)}</Pie><Tooltip {...tip} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} /></PieChart></ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Technician workload" subtitle="Active jobs per technician" columns={[{ key: 'name', label: 'Technician' }, { key: 'jobs', label: 'Active jobs' }]} rows={c.technicianWorkload} empty="No active jobs right now">
          <ResponsiveContainer><BarChart data={c.technicianWorkload} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}><CartesianGrid {...gridProps} horizontal={false} vertical /><XAxis type="number" allowDecimals={false} {...axisProps} /><YAxis type="category" dataKey="name" width={96} {...axisProps} /><Tooltip {...tip} /><Bar dataKey="jobs" name="Active jobs" fill={SERIES[0]} radius={[0, 4, 4, 0]} maxBarSize={22} /></BarChart></ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Monthly bookings" subtitle="Last 6 months" columns={[{ key: 'month', label: 'Month' }, { key: 'count', label: 'Bookings' }]} rows={c.monthlyBookings}>
          <ResponsiveContainer><LineChart data={c.monthlyBookings} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}><CartesianGrid {...gridProps} /><XAxis dataKey="month" {...axisProps} /><YAxis allowDecimals={false} {...axisProps} /><Tooltip {...tip} cursor={{ stroke: INK.grid }} /><Line type="monotone" dataKey="count" name="Bookings" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 4, fill: SERIES[0], stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} /></LineChart></ResponsiveContainer>
        </ChartCard>

        <div className="lg:col-span-2">
          <ChartCard title="Revenue & platform commission" subtitle="Paid bills, last 30 days (₹)" columns={[{ key: 'date', label: 'Date' }, { key: 'revenue', label: 'Revenue', format: inr }, { key: 'commission', label: 'Commission', format: inr }]} rows={c.revenueByDay} empty="No paid bills in the last 30 days">
            <ResponsiveContainer><LineChart data={c.revenueByDay} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}><CartesianGrid {...gridProps} /><XAxis dataKey="date" {...axisProps} tickFormatter={(d) => d.slice(5)} /><YAxis {...axisProps} tickFormatter={(v) => `₹${v}`} /><Tooltip {...tip} cursor={{ stroke: INK.grid }} formatter={(v) => inr(v)} /><Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="revenue" name="Revenue" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 3, fill: SERIES[0], stroke: '#fff', strokeWidth: 2 }} />
              <Line type="monotone" dataKey="commission" name="Commission" stroke={SERIES[1]} strokeWidth={2} dot={{ r: 3, fill: SERIES[1], stroke: '#fff', strokeWidth: 2 }} /></LineChart></ResponsiveContainer>
          </ChartCard>
        </div>
      </div>
      {s.openSupportTickets > 0 && <p className="text-sm text-ink-500">🛟 {s.openSupportTickets} open support ticket(s). <Link to="/admin/support" className="font-semibold text-brand-700 hover:underline">Review</Link></p>}
      {s.totalRequests === 0 && <EmptyState icon="📭" title="No requests yet" text="Charts fill in as customers start booking." />}
    </div>
  );
}
