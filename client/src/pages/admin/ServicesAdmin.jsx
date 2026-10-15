import { useState } from 'react';
import { ConfirmModal, EmptyState, ErrorBox, Field, Modal, Skeleton, Spinner } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useAsync';
import api, { errMsg } from '../../services/api';
import { CATEGORY_LABEL, inr } from '../../utils/format';

const BLANK = { name: '', slug: '', category: 'APPLIANCE', description: '', icon: '🔧', imageUrl: '', startingPrice: 499, durationMinutes: 60, commissionRate: '', minExperienceYears: 0, isActive: true, packages: [] };
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

export default function ServicesAdmin() {
  const toast = useToast();
  const { data, loading, error, reload } = useFetch('/admin/services');
  const [form, setForm] = useState(null); // service being edited (or blank)
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cat, setCat] = useState('');
  const list = (data ? data.services : []).filter((s) => !cat || s.category === cat);

  const save = async () => {
    const f = form;
    if (f.name.trim().length < 2) return toast.error('Enter a service name');
    if (!/^[a-z0-9-]+$/.test(f.slug)) return toast.error('Slug may contain only a-z, 0-9 and -');
    if (f.startingPrice === '' || Number(f.startingPrice) < 0) return toast.error('Enter a valid price');
    if (f.packages.some((p) => p.name.trim().length < 2 || p.price === '')) return toast.error('Every package needs a name and price');
    const body = {
      name: f.name.trim(), slug: f.slug, category: f.category, description: f.description, icon: f.icon || '🔧', imageUrl: f.imageUrl.trim(),
      startingPrice: Number(f.startingPrice), durationMinutes: Number(f.durationMinutes), minExperienceYears: Number(f.minExperienceYears), isActive: f.isActive,
      commissionRate: f.commissionRate === '' || f.commissionRate == null ? null : Number(f.commissionRate),
      packages: f.packages.map((p) => ({ name: p.name.trim(), price: Number(p.price), description: p.description || '' })),
    };
    setBusy(true);
    try {
      if (f._id) await api.put(`/admin/services/${f._id}`, body); else await api.post('/admin/services', body);
      toast.success(f._id ? 'Service updated' : 'Service added'); setForm(null); reload(false);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { const { data: d } = await api.delete(`/admin/services/${del._id}`); toast.success(d.message); setDel(null); reload(false); } catch (e) { toast.error(errMsg(e)); setDel(null); } finally { setBusy(false); }
  };
  const toggle = async (s) => {
    try { await api.put(`/admin/services/${s._id}`, { isActive: !s.isActive }); reload(false); } catch (e) { toast.error(errMsg(e)); }
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const setPkg = (i, k, v) => setForm({ ...form, packages: form.packages.map((p, j) => (j === i ? { ...p, [k]: v } : p)) });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="page-title">Services &amp; pricing</h1><p className="text-ink-500">Service-only catalogue. Packages (Basic / Deep / Premium) are service tiers, not products.</p></div>
        <button className="btn-primary" onClick={() => setForm({ ...BLANK })}>＋ Add service</button>
      </div>
      <div className="flex flex-wrap gap-2">{['', ...Object.keys(CATEGORY_LABEL)].map((c) => <button key={c} onClick={() => setCat(c)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${cat === c ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 bg-white'}`}>{c ? CATEGORY_LABEL[c] : 'All'}</button>)}</div>
      <ErrorBox message={error} onRetry={reload} />
      {loading ? <Skeleton className="h-64" /> : list.length ? (
        <div className="table-wrap">
          <table className="table min-w-[860px]">
            <thead><tr><th>Service</th><th>Category</th><th>From</th><th>Packages</th><th>Duration</th><th>Commission</th><th>Active</th><th /></tr></thead>
            <tbody>{list.map((s) => (
              <tr key={s._id} className={s.isActive ? '' : 'opacity-60'}>
                <td><span className="mr-2">{s.icon}</span><b>{s.name}</b><div className="text-xs text-ink-500">/{s.slug}</div></td>
                <td>{CATEGORY_LABEL[s.category]}</td><td>{inr(s.startingPrice)}</td>
                <td className="text-xs">{(s.packages || []).map((p) => `${p.name} ${inr(p.price)}`).join(' · ') || '—'}</td>
                <td>{s.durationMinutes} min</td><td>{s.commissionRate != null ? `${s.commissionRate}%` : 'Category default'}</td>
                <td><input type="checkbox" className="h-4 w-4" checked={s.isActive} onChange={() => toggle(s)} aria-label={`Toggle ${s.name}`} /></td>
                <td className="whitespace-nowrap text-right"><button className="btn-ghost btn-sm" onClick={() => setForm({ ...BLANK, ...s, commissionRate: s.commissionRate == null ? '' : s.commissionRate, imageUrl: s.imageUrl || '', packages: (s.packages || []).map((p) => ({ ...p })) })}>Edit</button><button className="btn-ghost btn-sm text-red-600" onClick={() => setDel(s)}>Delete</button></td>
              </tr>))}</tbody>
          </table>
        </div>
      ) : <EmptyState icon="🛠️" title="No services" text="Add your first service." />}

      {form && (
        <Modal open onClose={() => setForm(null)} wide title={form._id ? `Edit ${form.name}` : 'Add service'}
          footer={<><button className="btn-outline" onClick={() => setForm(null)}>Cancel</button><button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Save</button></>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: form._id ? form.slug : slugify(e.target.value) })} /></Field>
            <Field label="Slug" required hint="Used in the URL"><input className="input" value={form.slug} onChange={set('slug')} /></Field>
            <Field label="Category" required><select className="input" value={form.category} onChange={set('category')}>{Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Icon (emoji)"><input className="input" maxLength={8} value={form.icon} onChange={set('icon')} /></Field>
            <Field label="Starting price (₹)" required><input className="input" type="number" min="0" value={form.startingPrice} onChange={set('startingPrice')} /></Field>
            <Field label="Duration (minutes)"><input className="input" type="number" min="15" max="720" value={form.durationMinutes} onChange={set('durationMinutes')} /></Field>
            <Field label="Commission override (%)" hint="Blank = category default"><input className="input" type="number" min="0" max="60" value={form.commissionRate} onChange={set('commissionRate')} /></Field>
            <Field label="Minimum technician experience (years)"><input className="input" type="number" min="0" max="30" value={form.minExperienceYears} onChange={set('minExperienceYears')} /></Field>
            <div className="sm:col-span-2"><Field label="Image URL (optional)"><input className="input" value={form.imageUrl} onChange={set('imageUrl')} placeholder="https://… or /uploads/services/file.jpg" /></Field></div>
            <div className="sm:col-span-2"><Field label="Description"><textarea className="input min-h-[70px]" maxLength={500} value={form.description} onChange={set('description')} /></Field></div>
          </div>
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-bold">Service packages</h3>{form.packages.length < 6 && <button className="btn-outline btn-sm" onClick={() => setForm({ ...form, packages: [...form.packages, { name: '', price: '', description: '' }] })}>＋ Add package</button>}</div>
            {form.packages.length === 0 && <p className="text-xs text-ink-500">No packages — the starting price is used.</p>}
            <div className="space-y-2">{form.packages.map((p, i) => (
              <div key={i} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_120px_2fr_auto]">
                <input className="input" placeholder="Basic / Deep / Premium" value={p.name} onChange={(e) => setPkg(i, 'name', e.target.value)} aria-label="Package name" />
                <input className="input" type="number" min="0" placeholder="₹" value={p.price} onChange={(e) => setPkg(i, 'price', e.target.value)} aria-label="Package price" />
                <input className="input" placeholder="What's included" value={p.description} onChange={(e) => setPkg(i, 'description', e.target.value)} aria-label="Package description" />
                <button className="btn-ghost text-red-600" onClick={() => setForm({ ...form, packages: form.packages.filter((_, j) => j !== i) })} aria-label="Remove package">✕</button>
              </div>))}</div>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={form.isActive} onChange={set('isActive')} /> Active (visible to customers)</label>
        </Modal>
      )}
      <ConfirmModal open={Boolean(del)} onClose={() => setDel(null)} danger busy={busy} title={`Delete ${del ? del.name : ''}?`} message="Services with booking history are deactivated instead of deleted." confirmLabel="Delete" onConfirm={remove} />
    </div>
  );
}
