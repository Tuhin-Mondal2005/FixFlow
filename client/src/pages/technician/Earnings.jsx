import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorBox, PageLoader, PayBadge, Pagination, StatCard } from '../../components/ui';
import { useLiveRefresh } from '../../context/RealtimeContext';
import { useFetch } from '../../hooks/useAsync';
import { dateTime, inr } from '../../utils/format';

export default function Earnings() {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useFetch('/technicians/earnings', { page, limit: 12 });
  useLiveRefresh(reload);
  if (loading) return <PageLoader />;
  if (error || !data) return <ErrorBox message={error || 'Could not load earnings'} onRetry={reload} />;
  const s = data.summary;

  return (
    <div className="space-y-6">
      <h1 className="page-title">Earnings</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Today's earnings" value={inr(s.today)} icon="💰" tone="green" />
        <StatCard label="This week" value={inr(s.thisWeek)} icon="📅" tone="blue" />
        <StatCard label="This month" value={inr(s.thisMonth)} icon="🗓️" tone="purple" />
        <StatCard label="Completed jobs" value={s.completedJobs} icon="✅" tone="brand" />
        <StatCard label="Pending payout" value={inr(s.pendingPayout)} icon="⏳" tone="amber" hint="Online earnings owed to you" />
        <StatCard label="Commission due" value={inr(s.commissionDueFromCash)} icon="💵" tone="red" hint="Platform fee on cash jobs" />
      </div>
      {s.awaitingCustomerPayment.count > 0 && <p className="rounded-xl bg-slate-100 p-3 text-sm">{s.awaitingCustomerPayment.count} completed job(s) worth {inr(s.awaitingCustomerPayment.amount)} are waiting for the customer's payment.</p>}
      <div className="rounded-xl bg-brand-50 p-4 text-sm text-brand-900">Lifetime: you earned <b>{inr(s.totalEarned)}</b> after <b>{inr(s.totalPlatformFees)}</b> in platform fees. Online payments are paid out by the platform; for cash jobs you keep the cash and the platform fee is collected from you.</div>

      <section>
        <h2 className="section-title mb-3">Transaction ledger</h2>
        {data.transactions.length === 0 ? <EmptyState icon="🧾" title="No earnings yet" text="Completed and paid jobs will appear here with a full breakdown." /> : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Date</th><th>Service</th><th>Customer paid</th><th>Platform fee</th><th>You earned</th><th>Payment</th><th>Status</th></tr></thead>
                <tbody>{data.transactions.map((x) => (
                  <tr key={x._id} className={x.entryType === 'REVERSAL' ? 'text-red-700' : ''}>
                    <td className="whitespace-nowrap">{dateTime(x.earnedAt)}</td>
                    <td><Link to={`/technician/jobs/${x.requestId}`} className="font-semibold hover:underline">#{x.requestNumber} {x.serviceName}</Link>{x.entryType === 'REVERSAL' && <span className="ml-1 text-xs">(refund reversal)</span>}</td>
                    <td>{inr(x.customerPaid)}</td>
                    <td>{inr(x.platformFee)} <span className="text-xs text-ink-500">({x.commissionRate}%)</span></td>
                    <td className="font-bold">{inr(x.netEarning)}</td>
                    <td>{x.paymentMethod === 'ONLINE' ? 'Online' : 'Cash'}</td>
                    <td><PayBadge status={x.status} /> <span className="block text-xs text-ink-500">{x.payoutStatus === 'PENDING' ? 'payout pending' : x.payoutStatus === 'PAID_OUT' ? 'paid out' : x.payoutStatus === 'IN_HAND' ? 'cash in hand' : ''}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <Pagination page={data.page} pages={data.pages} onChange={setPage} />
          </>
        )}
      </section>
    </div>
  );
}
