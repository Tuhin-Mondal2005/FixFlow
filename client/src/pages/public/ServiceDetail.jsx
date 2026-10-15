import { Link, useParams } from 'react-router-dom';
import { ErrorBox, PageLoader, Stars } from '../../components/ui';
import { useFetch } from '../../hooks/useAsync';
import { CATEGORY_GRADIENT, CATEGORY_LABEL, dateOnly, inr } from '../../utils/format';

export default function ServiceDetail() {
  const { id } = useParams();
  const { data, loading, error, reload } = useFetch(`/services/${id}`);
  if (loading) return <PageLoader />;
  if (error || !data) return <div className="container-app py-10"><ErrorBox message={error || 'Service not found'} onRetry={reload} /><Link to="/services" className="btn-outline mt-4">← All services</Link></div>;
  const { service: s, reviews } = data;

  return (
    <div className="container-app py-10">
      <Link to="/services" className="text-sm font-semibold text-brand-700 hover:underline">← All services</Link>
      <div className="mt-4 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <div className={`flex h-56 items-center justify-center rounded-3xl bg-gradient-to-br ${CATEGORY_GRADIENT[s.category]} sm:h-72`}>
            {s.imageUrl ? <img src={s.imageUrl} alt={s.name} className="h-full w-full rounded-3xl object-cover" /> : <span className="text-8xl drop-shadow" aria-hidden="true">{s.icon}</span>}
          </div>
          <div className="mt-6">
            <span className="badge bg-brand-50 text-brand-700">{CATEGORY_LABEL[s.category]}</span>
            <h1 className="page-title mt-2">{s.name}</h1>
            <div className="mt-2"><Stars value={s.ratingAvg || 4.5} count={s.ratingCount || undefined} /></div>
            <p className="mt-4 text-ink-700">{s.description}</p>
            <ul className="mt-4 grid gap-2 text-sm text-ink-700 sm:grid-cols-2">
              <li>⏱️ Typical duration: {s.durationMinutes} min</li>
              <li>🛡️ Verified technicians only</li>
              <li>📍 Hyperlocal matching</li>
              <li>🧾 Final bill shown after the job</li>
            </ul>
            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">FixFlow provides the service only. If a spare part or replacement item is required, you arrange it yourself — we do not sell products.</p>
          </div>

          <h2 className="section-title mt-10">Customer reviews</h2>
          {reviews.length === 0 ? <p className="mt-2 text-ink-500">No reviews yet.</p> : (
            <div className="mt-4 space-y-3">{reviews.map((r, i) => (
              <div key={i} className="card p-4"><Stars value={r.rating} showNumber={false} />{r.comment && <p className="mt-1 text-sm">“{r.comment}”</p>}<p className="mt-1 text-xs text-ink-500">{r.customer} · {dateOnly(r.createdAt)}</p></div>
            ))}</div>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card-pad">
            <p className="text-sm text-ink-500">Starting from</p>
            <p className="text-4xl font-extrabold">{inr(s.startingPrice)}</p>
            {s.packages.length > 0 && (
              <div className="mt-5">
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-500">Service packages</h3>
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {s.packages.map((p) => (
                    <li key={p.name} className="flex items-center justify-between px-4 py-3"><div><div className="font-semibold">{p.name}</div>{p.description && <div className="text-xs text-ink-500">{p.description}</div>}</div><div className="font-bold">{inr(p.price)}</div></li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-ink-500">Packages are levels of service, not products.</p>
              </div>
            )}
            <Link to={`/customer/request?service=${s._id}`} className="btn-primary btn-lg mt-6 w-full">Book Service</Link>
            <Link to={`/customer/request?service=${s._id}&urgency=HIGH`} className="btn-outline mt-2 w-full">🚨 Emergency booking</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
