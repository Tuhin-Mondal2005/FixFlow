import { Link, useParams } from 'react-router-dom';
import { ErrorBox, PageLoader } from '../../components/ui';
import { useFetch } from '../../hooks/useAsync';
import { dateOnly, inr } from '../../utils/format';

export default function Invoice() {
  const { id } = useParams();
  const { data, loading, error, reload } = useFetch(`/requests/${id}/invoice`);
  if (loading) return <PageLoader />;
  if (error || !data) return <div className="space-y-3"><ErrorBox message={error || 'Invoice not available'} onRetry={reload} /><Link to={`/customer/request/${id}`} className="btn-outline">← Back</Link></div>;
  const i = data.invoice;
  const Row = ({ k, v, bold }) => <div className={`flex justify-between gap-4 py-2 ${bold ? 'border-t border-slate-200 text-lg font-bold' : ''}`}><span className="text-ink-500">{k}</span><span className="text-right">{v}</span></div>;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between print:hidden"><Link to={`/customer/request/${id}`} className="text-sm font-semibold text-brand-700 hover:underline">← Request</Link><button className="btn-primary btn-sm" onClick={() => window.print()}>🖨️ Print / Save PDF</button></div>
      <div className="card-pad print:border-0 print:shadow-none">
        <div className="flex items-start justify-between"><div><div className="text-2xl font-extrabold">FIX<span className="text-brand-500">FLOW</span></div><div className="text-xs text-ink-500">Digital invoice</div></div><div className="text-right text-sm"><div className="font-bold">{i.invoiceNumber}</div><div className="text-ink-500">{dateOnly(i.date)}</div></div></div>
        <div className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div><div className="text-xs font-semibold uppercase text-ink-500">Billed to</div><div className="font-semibold">{i.customer.name}</div><div>{i.customer.address}</div><div>{i.customer.phone}</div></div>
          <div><div className="text-xs font-semibold uppercase text-ink-500">Service</div><div className="font-semibold">{i.service}{i.package ? ` · ${i.package}` : ''}</div><div>Request #{i.requestNumber}</div><div>Date: {dateOnly(i.serviceDate)}</div><div>Technician: {i.technician ? i.technician.name : '—'}</div></div>
        </div>
        <div className="mt-6 divide-y divide-slate-100 text-sm">
          <Row k="Service amount" v={inr(i.amount)} />
          <Row k={`Platform fee (${i.commissionRate}%)`} v={inr(i.platformFee)} />
          <Row k="Technician earning" v={inr(i.technicianEarning)} />
          <Row k="Payment method" v={i.paymentMethod} />
          <Row k="Payment status" v={i.paymentStatus} />
          <Row k="Total paid by customer" v={inr(i.amount)} bold />
        </div>
        <p className="mt-6 rounded-xl bg-slate-50 p-3 text-xs text-ink-500">{i.note}</p>
      </div>
    </div>
  );
}
