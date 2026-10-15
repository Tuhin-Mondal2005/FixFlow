import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ConfirmModal, EmptyState, ErrorBox, PayBadge, Pagination, Skeleton, StatCard } from '../../components/ui';
import { useLiveRefresh } from '../../context/RealtimeContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useAsync';
import api, { errMsg } from '../../services/api';
import { dateTime, inr } from '../../utils/format';

export default function PaymentsAdmin() {
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const f = { status: sp.get('status') || '', method: sp.get('method') || '' };
  const setF = (next) => { const n = new URLSearchParams(); Object.entries(next).forEach(([k, v]) => { if (v) n.set(k, v); }); setSp(n, { replace: true }); };
  const [page, setPage] = useState(1);
  const params = { page, ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)) };
  const { data, loading, error, reload } = useFetch('/admin/payments', params);
  useLiveRefresh(reload);
  const [refund, setRefund] = useState(null);
  const [settle, setSettle] = useState(null);
  const [busy, setBusy] = useState(false);

  const doRefund = async () => {
    setBusy(true);
    try { await api.put(`/admin/payments/${refund._id}/refund`); toast.success('Payment refunded'); setRefund(null); reload(false); } catch (e) { toast.error(errMsg(e)); setRefund(null); } finally { setBusy(false); }
  };
  const doSettle = async () => {
    setBusy(true);
    try { await api.post(`/admin/payouts/${settle.technicianId}/settle`); toast.success('Settled'); setSettle(null); reload(false); } catch (e) { toast.error(errMsg(e)); setSettle(null); } finally { setBusy(false); }
  };
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setPage(1); };
  const t = data && data.totals;

  return (
    <div className="space-y-6">
      <h1 className="page-title">Payments &amp; payouts</h1>
      <ErrorBox message={error} onRetry={reload} />
      {t && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard label="Gross revenue" value={inr(t.revenue)} icon="💰" tone="green" hint={`${t.paidCount} paid`} /><StatCard label="Platform commission" value={inr(t.commission)} icon="🏦" tone="blue" /><StatCard label="Technician earnings" value={inr(t.technicianEarnings)} icon="🧑‍🔧" tone="purple" /><StatCard label="Open settlements" value={data.payouts.length} icon="⏳" tone="amber" /></div>}

      <section>
        <h2 className="section-title mb-3">Pending settlements</h2>
        {data && data.payouts.length ? (
          <div className="table-wrap"><table className="table"><thead><tr><th>Technician</th><th>Type</th><th>Jobs</th><th>Amount</th><th /></tr></thead><tbody>{data.payouts.map((p) => (
            <tr key={`${p.technicianId}-${p.method}`}><td className="font-semibold">{p.technician}</td><td>{p.direction === 'PAY_TECHNICIAN' ? 'Pay technician (online earnings)' : 'Collect commission (cash jobs)'}</td><td>{p.jobs}</td><td>{inr(p.amount)}</td><td className="text-right"><button className="btn-outline btn-sm" onClick={() => setSettle(p)}>Mark settled</button></td></tr>))}</tbody></table></div>
        ) : <p className="text-sm text-ink-500">Nothing to settle.</p>}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="section-title">All payments</h2>
          <div className="flex gap-2"><select className="input" value={f.status} onChange={set('status')} aria-label="Status"><option value="">Any status</option><option>PENDING</option><option>PAID</option><option>FAILED</option><option>REFUNDED</option></select><select className="input" value={f.method} onChange={set('method')} aria-label="Method"><option value="">Any method</option><option>ONLINE</option><option>CASH</option></select></div></div>
        {loading ? <Skeleton className="h-64" /> : data && data.payments.length ? (
          <>
            <div className="table-wrap"><table className="table min-w-[900px]"><thead><tr><th>Request</th><th>Customer</th><th>Technician</th><th>Amount</th><th>Commission</th><th>Tech. earning</th><th>Method</th><th>Status</th><th>Paid</th><th /></tr></thead><tbody>{data.payments.map((p) => (
              <tr key={p._id}><td>#{p.requestNumber}<div className="text-xs text-ink-500">{p.serviceName}</div></td><td>{p.customer || '—'}</td><td>{p.technician || '—'}</td><td className="font-semibold">{inr(p.amount)}</td><td>{inr(p.commission)} <span className="text-xs text-ink-500">({p.commissionRate}%)</span></td><td>{inr(p.technicianEarning)}</td><td>{p.method}</td><td><PayBadge status={p.status} /></td><td className="text-xs">{p.paidAt ? dateTime(p.paidAt) : '—'}</td><td className="text-right">{p.status === 'PAID' && <button className="btn-ghost btn-sm text-red-600" onClick={() => setRefund(p)}>Refund</button>}</td></tr>))}</tbody></table></div>
            <Pagination page={data.page} pages={data.pages} onChange={setPage} />
          </>
        ) : <EmptyState icon="💳" title="No payments" text="Payments appear here once customers pay." />}
      </section>

      <ConfirmModal open={Boolean(refund)} onClose={() => setRefund(null)} danger busy={busy} title="Refund this payment?" message={refund ? `${inr(refund.amount)} for request #${refund.requestNumber} will be refunded and the technician's earning reversed.` : ''} confirmLabel="Refund" onConfirm={doRefund} />
      <ConfirmModal open={Boolean(settle)} onClose={() => setSettle(null)} busy={busy} title="Mark as settled?" message={settle ? `${settle.technician}: ${settle.direction === 'PAY_TECHNICIAN' ? `you have paid out ${inr(settle.amount)}` : `you have collected ${inr(settle.amount)} commission`}.` : ''} confirmLabel="Mark settled" onConfirm={doSettle} />
    </div>
  );
}
