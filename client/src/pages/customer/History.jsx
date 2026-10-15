import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorBox, PayBadge, Pagination, PageLoader, StatusBadge } from '../../components/ui';
import { useFetch } from '../../hooks/useAsync';
import { dateOnly, inr } from '../../utils/format';

export default function History() {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useFetch('/requests/my', { group: 'history', page, limit: 15 });
  return (
    <div className="space-y-5">
      <h1 className="page-title">Service history</h1>
      <ErrorBox message={error} onRetry={reload} />
      {loading ? <PageLoader /> : data && data.requests.length ? (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>#</th><th>Service</th><th>Date</th><th>Technician</th><th>Amount</th><th>Status</th><th>Payment</th><th /></tr></thead>
              <tbody>{data.requests.map((r) => (
                <tr key={r._id}>
                  <td className="font-semibold">{r.requestNumber}</td>
                  <td>{r.serviceName}</td>
                  <td>{dateOnly(r.completedAt || r.scheduledAt)}</td>
                  <td>{r.technician ? r.technician.name : '—'}</td>
                  <td>{inr(r.finalAmount ?? r.price)}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{r.status === 'COMPLETED' ? <PayBadge status={r.paymentStatus} /> : '—'}</td>
                  <td className="text-right"><Link to={`/customer/request/${r._id}`} className="font-semibold text-brand-700 hover:underline">Open</Link></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      ) : <EmptyState icon="🕘" title="No history yet" text="Completed and cancelled services are listed here." />}
    </div>
  );
}
