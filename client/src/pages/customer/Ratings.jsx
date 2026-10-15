import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorBox, PageLoader, Spinner, StarInput, Stars } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useAsync';
import api, { errMsg } from '../../services/api';
import { dateOnly } from '../../utils/format';

function RateForm({ request, onDone }) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!rating) return toast.error('Please select a star rating');
    setBusy(true);
    try { await api.post(`/requests/${request._id}/rating`, { rating, comment }); toast.success('Thank you for your feedback!'); onDone(); } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="card-pad space-y-3 border-2 border-brand-200">
      <div className="text-sm text-ink-500">Request #{request.requestNumber} · {request.serviceName}</div>
      <div className="font-bold">Rate {request.technician ? request.technician.name : 'your technician'}</div>
      <StarInput value={rating} onChange={setRating} />
      <textarea className="input" rows={3} maxLength={600} placeholder="Technician arrived on time and solved the problem." value={comment} onChange={(e) => setComment(e.target.value)} aria-label="Comment" />
      <button className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4" />} Submit review</button>
    </form>
  );
}

export default function Ratings() {
  const [params] = useSearchParams();
  const focus = params.get('request');
  const mine = useFetch('/requests/ratings/mine');
  const done = useFetch('/requests/my', { group: 'completed', limit: 50 });
  const reloadAll = () => { mine.reload(); done.reload(); };
  if (mine.loading || done.loading) return <PageLoader />;

  const pending = (done.data ? done.data.requests : []).filter((r) => !r.isRated && r.technician);
  const ordered = [...pending.filter((r) => r._id === focus), ...pending.filter((r) => r._id !== focus)];

  return (
    <div className="space-y-6">
      <h1 className="page-title">Ratings & feedback</h1>
      <ErrorBox message={mine.error || done.error} onRetry={reloadAll} />
      {ordered.length > 0 && <section className="space-y-3"><h2 className="section-title">Waiting for your review</h2>{ordered.map((r) => <RateForm key={r._id} request={r} onDone={reloadAll} />)}</section>}
      <section>
        <h2 className="section-title mb-3">Your reviews</h2>
        {mine.data && mine.data.ratings.length ? (
          <div className="grid gap-3 md:grid-cols-2">{mine.data.ratings.map((r) => (
            <div key={r._id} className="card p-4"><div className="flex items-center justify-between"><Stars value={r.rating} showNumber={false} /><span className="text-xs text-ink-500">{dateOnly(r.createdAt)}</span></div>
              <div className="mt-1 text-sm font-semibold">{r.serviceName} · #{r.requestNumber}</div>{r.technician && <div className="text-xs text-ink-500">Technician: {r.technician}</div>}{r.comment && <p className="mt-2 text-sm">“{r.comment}”</p>}</div>
          ))}</div>
        ) : <EmptyState icon="⭐" title="No reviews yet" text="After a service is completed you can rate your technician." />}
      </section>
    </div>
  );
}
