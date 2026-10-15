import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorBox, PageLoader, PayBadge, Spinner } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useAsync';
import api, { errMsg } from '../../services/api';
import { dateOnly, inr } from '../../utils/format';

let rzpPromise = null;
const loadRazorpay = () => {
  if (window.Razorpay) return Promise.resolve();
  if (!rzpPromise) rzpPromise = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.onload = res; s.onerror = () => { rzpPromise = null; rej(new Error('Could not load Razorpay')); }; document.body.appendChild(s); });
  return rzpPromise;
};

function PayPanel({ bill, onDone }) {
  const toast = useToast();
  const [busy, setBusy] = useState('');

  const verify = async (payload) => {
    await api.post('/payments/verify', payload); // the SERVER checks the signature; the browser's word is never trusted
    toast.success('Payment confirmed. Thank you!');
    onDone();
  };

  const payOnline = async () => {
    setBusy('online');
    try {
      const { data } = await api.post(`/payments/request/${bill.requestId}/online-order`);
      if (data.mock) {
        // Development: no Razorpay keys on the server. The server signs a fake checkout result which then goes through the SAME verification.
        const { data: m } = await api.post('/payments/dev/mock-checkout', { orderId: data.order.id });
        await verify(m.result);
      } else {
        await loadRazorpay();
        await new Promise((resolve, reject) => {
          const rzp = new window.Razorpay({
            key: data.keyId, amount: data.order.amount, currency: data.order.currency, order_id: data.order.id, name: 'FixFlow', description: `Request #${bill.requestNumber}`,
            theme: { color: '#0b7c78' },
            handler: async (resp) => { try { await verify(resp); resolve(); } catch (e) { reject(e); } },
            modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
          });
          rzp.on('payment.failed', (r) => reject(new Error(r.error && r.error.description ? r.error.description : 'Payment failed')));
          rzp.open();
        });
      }
    } catch (e) { toast.error(errMsg(e, e.message)); onDone(); } finally { setBusy(''); }
  };

  const payCash = async () => {
    setBusy('cash');
    try { await api.post(`/payments/request/${bill.requestId}/cash`); toast.success('Please pay the technician in cash. They will confirm receipt.'); onDone(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(''); }
  };

  return (
    <div className="card-pad border-2 border-brand-200">
      <div className="text-sm text-ink-500">Request #{bill.requestNumber} · {bill.serviceName}</div>
      <div className="mt-1 flex items-baseline gap-3"><span className="text-4xl font-extrabold">{inr(bill.amount)}</span><PayBadge status={bill.status} /></div>
      {bill.method === 'CASH' && bill.status === 'PENDING' && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">You chose cash. Hand over the amount to the technician — they confirm it in their app.</p>}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button className="btn-primary btn-lg" onClick={payOnline} disabled={Boolean(busy)}>{busy === 'online' ? <Spinner className="h-4 w-4" /> : '💳'} Pay online</button>
        <button className="btn-outline btn-lg" onClick={payCash} disabled={Boolean(busy) || bill.method === 'CASH'}>{busy === 'cash' ? <Spinner className="h-4 w-4" /> : '💵'} {bill.method === 'CASH' ? 'Cash selected' : 'Pay cash to technician'}</button>
      </div>
      <p className="mt-3 text-xs text-ink-500">Online payments are verified securely on our server before they are marked as paid.</p>
    </div>
  );
}

export default function Payments() {
  const [params] = useSearchParams();
  const focus = params.get('request');
  const { data, loading, error, reload } = useFetch('/payments/my');
  const [, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 60000); return () => clearInterval(t); }, []);

  if (loading) return <PageLoader />;
  const all = data ? data.payments : [];
  const toPay = all.filter((p) => ['PENDING', 'FAILED'].includes(p.status));
  const history = all.filter((p) => !['PENDING', 'FAILED'].includes(p.status));
  const ordered = [...toPay.filter((p) => p.requestId === focus), ...toPay.filter((p) => p.requestId !== focus)];

  return (
    <div className="space-y-6">
      <h1 className="page-title">Payments</h1>
      <ErrorBox message={error} onRetry={reload} />
      {ordered.length > 0 && <section className="space-y-3"><h2 className="section-title">Bills to pay</h2>{ordered.map((b) => <PayPanel key={b._id} bill={b} onDone={() => reload()} />)}</section>}
      <section>
        <h2 className="section-title mb-3">Payment history</h2>
        {history.length === 0 ? <EmptyState icon="💳" title="No payments yet" text="Paid bills and invoices will be listed here." /> : (
          <div className="table-wrap"><table className="table"><thead><tr><th>Request</th><th>Service</th><th>Date</th><th>Method</th><th>Amount</th><th>Status</th><th /></tr></thead>
            <tbody>{history.map((p) => (
              <tr key={p._id}><td className="font-semibold">#{p.requestNumber}</td><td>{p.serviceName}</td><td>{dateOnly(p.paidAt || p.createdAt)}</td><td>{p.method || '—'}</td><td>{inr(p.amount)}</td><td><PayBadge status={p.status} /></td>
                <td className="text-right">{p.status === 'PAID' && <Link className="font-semibold text-brand-700 hover:underline" to={`/customer/invoice/${p.requestId}`}>Invoice</Link>}</td></tr>
            ))}</tbody></table></div>
        )}
      </section>
    </div>
  );
}
