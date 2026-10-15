import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import TechnicianFormModal from '../../components/TechnicianFormModal';
import { AvailabilityBadge, ConfirmModal, EmptyState, ErrorBox, Pagination, Skeleton, Stars, VerifyBadge } from '../../components/ui';
import { useLiveRefresh } from '../../context/RealtimeContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useAsync';
import api, { errMsg } from '../../services/api';

const FILTER_KEYS = ['q', 'verificationStatus', 'availabilityStatus', 'skill', 'isActive', 'deleted'];

export default function AdminTechnicians() {
  const toast = useToast();
  // Filters live in the URL so dashboard cards can open a filtered list directly.
  const [sp, setSp] = useSearchParams();
  const f = Object.fromEntries(FILTER_KEYS.map((k) => [k, sp.get(k) || '']));
  const label = sp.get('label') || '';
  const page = Math.max(1, Number(sp.get('page')) || 1);
  const params = { page, limit: 15, ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)) };
  const { data, loading, error, reload } = useFetch('/admin/technicians', params);
  const services = useFetch('/admin/services');
  useLiveRefresh(reload, ['admin:event']);
  const [form, setForm] = useState({ open: false, tech: null });
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState('');
  const names = Object.fromEntries((services.data ? services.data.services : []).map((s) => [s.slug, s.name]));

  const commit = (changes, { dropLabel = true } = {}) => {
    const n = new URLSearchParams(sp);
    Object.entries(changes).forEach(([k, v]) => (v ? n.set(k, String(v)) : n.delete(k)));
    if (dropLabel) n.delete('label');
    setSp(n, { replace: true });
  };
  const setFilter = (k) => (e) => commit({ [k]: e.target.value, page: '' });
  // the verification dropdown doubles as the "Removed" view (records of removed technicians are kept)
  const setVerification = (e) => {
    const v = e.target.value;
    commit(v === 'REMOVED' ? { deleted: 'true', verificationStatus: '', page: '' } : { deleted: '', verificationStatus: v, page: '' });
  };
  const verificationValue = f.deleted === 'true' ? 'REMOVED' : f.verificationStatus;
  const setPage = (p) => commit({ page: p > 1 ? p : '' }, { dropLabel: false });
  const clearAll = () => setSp(new URLSearchParams(), { replace: true });
  const showingFilters = Boolean(label) || Object.values(f).some(Boolean);

  const toggleActive = async (t) => {
    setBusy(t._id);
    try { await api.put(`/admin/technicians/${t._id}/${t.isActive ? 'deactivate' : 'activate'}`); toast.success(t.isActive ? 'Technician deactivated' : 'Technician activated'); reload(false); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(''); }
  };
  const remove = async () => {
    setBusy(del._id);
    try { await api.delete(`/admin/technicians/${del._id}`); toast.success('Technician removed (records kept)'); setDel(null); reload(false); } catch (e) { toast.error(errMsg(e)); setDel(null); } finally { setBusy(''); }
  };

  const verifyCell = (t) => (t.deletedAt ? <span className="badge bg-slate-200 text-slate-700">Removed</span> : <VerifyBadge status={t.verificationStatus} />);
  const actions = (t) => (t.deletedAt ? null : (
    <>
      <button className="btn-ghost btn-sm" onClick={() => setForm({ open: true, tech: t })}>Edit</button>
      {t.verificationStatus === 'APPROVED' && <button className="btn-ghost btn-sm" disabled={busy === t._id} onClick={() => toggleActive(t)}>{t.isActive ? 'Deactivate' : 'Activate'}</button>}
      <button className="btn-ghost btn-sm text-red-600" onClick={() => setDel(t)}>Delete</button>
    </>
  ));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="page-title">Technicians</h1><div className="flex flex-wrap gap-2"><Link to="/admin/technicians/pending" className="btn-outline">🛡️ Pending</Link><button className="btn-primary" onClick={() => setForm({ open: true, tech: null })}>＋ Add technician</button></div></div>

      <div className="card grid min-w-0 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <input className="input" placeholder="Search name, phone, area…" value={f.q} onChange={setFilter('q')} aria-label="Search" />
        <select className="input" value={verificationValue} onChange={setVerification} aria-label="Verification"><option value="">Any verification</option><option>PENDING</option><option>APPROVED</option><option>REJECTED</option><option value="REMOVED">Removed (records kept)</option></select>
        <select className="input" value={f.availabilityStatus} onChange={setFilter('availabilityStatus')} aria-label="Availability"><option value="">Any availability</option><option>AVAILABLE</option><option>BUSY</option><option>OFFLINE</option><option>ON_LEAVE</option></select>
        <select className="input" value={f.skill} onChange={setFilter('skill')} aria-label="Skill"><option value="">Any skill</option>{(services.data ? services.data.services : []).map((s) => <option key={s._id} value={s.slug}>{s.name}</option>)}</select>
      </div>

      {showingFilters && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm">
          <span>Showing <b>{label || 'filtered technicians'}</b>{data && ` · ${data.total} result${data.total === 1 ? '' : 's'}`}</span>
          <button className="btn-outline btn-sm" onClick={clearAll}>Clear filters</button>
        </div>
      )}

      <ErrorBox message={error} onRetry={reload} />
      {loading ? <Skeleton className="h-64" /> : data && data.technicians.length ? (
        <>
          {/* phones: one card per technician */}
          <ul className="space-y-3 xl:hidden">
            {data.technicians.map((t) => (
              <li key={t._id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><Link to={`/admin/technicians/${t._id}`} className="font-semibold hover:text-brand-700">{t.name}</Link><div className="text-xs text-ink-500">{t.phone}</div></div>
                  {verifyCell(t)}
                </div>
                <div className="mt-2 flex flex-wrap gap-1"><AvailabilityBadge status={t.availabilityStatus} />{!t.isActive && t.verificationStatus === 'APPROVED' && !t.deletedAt && <span className="badge bg-red-100 text-red-700">Deactivated</span>}</div>
                <p className="mt-2 line-clamp-2 text-xs text-ink-500">{t.skills.map((s) => names[s] || s).join(', ')}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span>{t.experience}y exp.</span><span>{t.completedJobs} jobs</span><span>Workload {t.currentJobs}</span>
                  <span>{t.ratingCount ? <Stars value={t.rating} showNumber size="text-xs" /> : <span className="text-ink-500">New</span>}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-end gap-1 border-t border-slate-100 pt-3">
                  <Link className="btn-outline btn-sm" to={`/admin/technicians/${t._id}`}>View</Link>
                  {actions(t)}
                </div>
              </li>
            ))}
          </ul>

          {/* tablet / desktop: table */}
          <div className="table-wrap hidden xl:block">
            <table className="table min-w-[980px]">
              <thead><tr><th>Technician</th><th>Skills</th><th>Exp.</th><th>Rating</th><th>Jobs</th><th>Workload</th><th>Availability</th><th>Verification</th><th /></tr></thead>
              <tbody>{data.technicians.map((t) => (
                <tr key={t._id}>
                  <td><Link to={`/admin/technicians/${t._id}`} className="font-semibold hover:text-brand-700">{t.name}</Link><div className="text-xs text-ink-500">{t.phone}</div></td>
                  <td className="max-w-[220px]"><div className="line-clamp-2 text-xs">{t.skills.map((s) => names[s] || s).join(', ')}</div></td>
                  <td>{t.experience}y</td>
                  <td>{t.ratingCount ? <Stars value={t.rating} showNumber size="text-xs" /> : <span className="text-ink-500">New</span>}</td>
                  <td>{t.completedJobs}</td>
                  <td>{t.currentJobs}</td>
                  <td><AvailabilityBadge status={t.availabilityStatus} />{!t.isActive && t.verificationStatus === 'APPROVED' && !t.deletedAt && <span className="badge ml-1 bg-red-100 text-red-700">Deactivated</span>}</td>
                  <td>{verifyCell(t)}</td>
                  <td className="whitespace-nowrap text-right">{actions(t)}</td>
                </tr>))}</tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      ) : <EmptyState icon="🧰" title="No technicians match" text={showingFilters ? 'Nothing matches this view yet.' : 'Add a technician to get started.'} action={showingFilters ? <button className="btn-outline" onClick={clearAll}>Clear filters</button> : null} />}

      <TechnicianFormModal open={form.open} technician={form.tech} services={services.data ? services.data.services : []} onClose={() => setForm({ open: false, tech: null })} onSaved={() => reload(false)} />
      <ConfirmModal open={Boolean(del)} onClose={() => setDel(null)} danger busy={Boolean(busy)} title={`Delete ${del ? del.name : ''}?`} message="Their login is disabled and unstarted jobs are reassigned. Job history and their Aadhaar and certificate copies are kept for records." confirmLabel="Delete" onConfirm={remove} />
    </div>
  );
}
