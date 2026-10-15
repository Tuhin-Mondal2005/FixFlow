import { useMemo, useState } from 'react';
import ServiceCard from '../../components/ServiceCard';
import { EmptyState, ErrorBox, Skeleton } from '../../components/ui';
import { useFetch } from '../../hooks/useAsync';
import { CATEGORY_LABEL } from '../../utils/format';

export default function Services() {
  const { data, loading, error, reload } = useFetch('/services');
  const [cat, setCat] = useState('ALL');
  const [q, setQ] = useState('');
  const all = data ? data.services : [];

  const filtered = useMemo(
    () => all.filter((s) => (cat === 'ALL' || s.category === cat) && s.name.toLowerCase().includes(q.trim().toLowerCase())),
    [all, cat, q]
  );
  const groups = Object.keys(CATEGORY_LABEL).map((c) => ({ c, items: filtered.filter((s) => s.category === c) })).filter((g) => g.items.length);

  return (
    <div className="container-app py-10">
      <h1 className="page-title">Our services</h1>
      <p className="mt-1 max-w-2xl text-ink-500">Labour and expertise only — FixFlow does not sell products or spare parts. If a replacement item is needed, you arrange it. Prices are "starting from" demo values.</p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input className="input sm:max-w-xs" placeholder="Search services…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search services" />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['ALL', ...Object.keys(CATEGORY_LABEL)].map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${cat === c ? 'bg-brand-600 text-white' : 'bg-white text-ink-700 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
              {c === 'ALL' ? 'All' : CATEGORY_LABEL[c].replace(' Services', '')}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6"><ErrorBox message={error} onRetry={reload} /></div>
      {loading && <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-64" />)}</div>}
      {!loading && !error && groups.length === 0 && <div className="mt-8"><EmptyState icon="🔎" title="No services found" text="Try a different search or category." /></div>}

      {groups.map((g) => (
        <section key={g.c} className="mt-10">
          <h2 className="section-title mb-4">{CATEGORY_LABEL[g.c]}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{g.items.map((s) => <ServiceCard key={s._id} service={s} />)}</div>
        </section>
      ))}
    </div>
  );
}
