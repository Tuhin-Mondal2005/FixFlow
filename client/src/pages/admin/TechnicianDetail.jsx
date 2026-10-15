import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import DocViewer from '../../components/DocViewer';
import { MapView } from '../../components/Maps';
import TechnicianFormModal from '../../components/TechnicianFormModal';
import { AvailabilityBadge, ErrorBox, PageLoader, StatusBadge, Stars, StatCard, VerifyBadge } from '../../components/ui';
import { useFetch } from '../../hooks/useAsync';
import api, { errMsg } from '../../services/api';
import { dateOnly, dateTime, inr } from '../../utils/format';

export default function AdminTechnicianDetail() {
  const { id } = useParams();
  const { data, loading, error, reload } = useFetch(`/admin/technicians/${id}`);
  const services = useFetch('/admin/services');
  const [view, setView] = useState(null);
  const [edit, setEdit] = useState(false);
  const [revealed, setRevealed] = useState('');
  const [revealBusy, setRevealBusy] = useState(false);
  const [revealErr, setRevealErr] = useState('');
  // the full number is hidden again automatically after 30 seconds
  useEffect(() => { if (!revealed) return undefined; const timer = setTimeout(() => setRevealed(''), 30000); return () => clearTimeout(timer); }, [revealed]);
  const revealAadhaar = async () => {
    setRevealBusy(true); setRevealErr('');
    try { const { data: d } = await api.get(`/admin/technicians/${id}/aadhaar`); setRevealed(d.aadhaarNumber); } catch (e) { setRevealErr(errMsg(e)); } finally { setRevealBusy(false); }
  };
  if (loading) return <PageLoader />;
  if (error || !data) return <div className="space-y-3"><ErrorBox message={error || 'Not found'} onRetry={reload} /><Link to="/admin/technicians" className="btn-outline">← Technicians</Link></div>;
  const t = data.technician;
  const names = Object.fromEntries((services.data ? services.data.services : []).map((s) => [s.slug, s.name]));
  const js = data.jobStats;

  return (
    <div className="space-y-6">
      <Link to="/admin/technicians" className="text-sm font-semibold text-brand-700 hover:underline">← Technicians</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          {t.profilePhoto ? <img src={t.profilePhoto} alt="" className="h-16 w-16 rounded-full object-cover" /> : <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-2xl font-bold text-brand-700">{t.name[0]}</div>}
          <div><h1 className="page-title">{t.name}</h1><div className="mt-1 flex flex-wrap gap-2"><VerifyBadge status={t.verificationStatus} /><AvailabilityBadge status={t.availabilityStatus} />{!t.isActive && <span className="badge bg-red-100 text-red-700">Inactive</span>}{t.deletedAt && <span className="badge bg-slate-200 text-slate-700">Removed · records kept</span>}</div></div>
        </div>
        {!t.deletedAt && <button className="btn-outline" onClick={() => setEdit(true)}>✏️ Edit</button>}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Rating" value={t.ratingCount ? t.rating.toFixed(2) : '—'} icon="⭐" tone="amber" hint={`${t.ratingCount} reviews`} />
        <StatCard label="Completed jobs" value={t.completedJobs} icon="✅" tone="green" />
        <StatCard label="Current workload" value={t.currentJobs} icon="⚡" tone="blue" hint={t.currentStatus} />
        <StatCard label="No-shows / timeouts" value={`${t.noShows} / ${t.missedResponses}`} icon="⚠️" tone="red" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card-pad space-y-3 text-sm">
          <h2 className="font-bold">Profile</h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div><dt className="text-xs text-ink-500">Phone</dt><dd>{t.phone}</dd></div>
            <div><dt className="text-xs text-ink-500">Email</dt><dd className="break-all">{t.email}</dd></div>
            <div><dt className="text-xs text-ink-500">Experience</dt><dd>{t.experience} years</dd></div>
            <div><dt className="text-xs text-ink-500">Service radius</dt><dd>{t.serviceRadiusKm} km</dd></div>
            <div><dt className="text-xs text-ink-500">Working hours</dt><dd>{t.workingHours.start} – {t.workingHours.end}</dd></div>
            <div><dt className="text-xs text-ink-500">Available from</dt><dd>{t.availableFrom ? dateTime(t.availableFrom) : '—'}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs text-ink-500">Skills</dt><dd>{t.skills.map((s) => names[s] || s).join(', ')}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs text-ink-500">Certifications</dt><dd>{t.certifications.length ? t.certifications.join(', ') : '—'}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs text-ink-500">Location</dt><dd>{t.location.address}</dd></div>
            {t.rejectionReason && <div className="sm:col-span-2"><dt className="text-xs text-ink-500">Rejection reason</dt><dd className="text-red-700">{t.rejectionReason}</dd></div>}
            <div className="sm:col-span-2"><dt className="text-xs text-ink-500">Aadhaar number</dt><dd className="mt-1 flex flex-wrap items-center gap-2">
              <span className="font-mono tracking-wider">{revealed ? revealed.replace(/(\d{4})(?=\d)/g, '$1 ') : t.aadhaarMasked}</span>
              {!revealed && <button className="btn-outline btn-sm" disabled={revealBusy} onClick={revealAadhaar}>{revealBusy ? 'Opening…' : '👁 Reveal'}</button>}
              {revealed && <button className="btn-ghost btn-sm" onClick={() => setRevealed('')}>Hide</button>}
              {revealErr && <span className="w-full text-xs text-red-600">{revealErr}</span>}
            </dd><p className="mt-1 text-xs text-ink-500">Each reveal is recorded in the audit log and hides after 30 seconds.</p></div>
            <div><dt className="text-xs text-ink-500">Joined</dt><dd>{dateOnly(t.createdAt)}</dd></div>
          </dl>
          <div className="flex flex-wrap gap-2 pt-2">
            {t.documents.aadhaar && <button className="btn-outline btn-sm" onClick={() => setView({ doc: { kind: 'aadhaar', index: 0 }, label: 'Aadhaar document' })}>🪪 View Aadhaar</button>}
            {t.documents.qualification.map((d, i) => <button key={d.id} className="btn-outline btn-sm" onClick={() => setView({ doc: { kind: 'qualification', index: i }, label: `Certificate ${i + 1}` })}>📄 Certificate {i + 1}</button>)}
          </div>
        </section>
        <section className="card-pad space-y-3"><h2 className="font-bold">Base location</h2><MapView latitude={t.location.latitude} longitude={t.location.longitude} label="Technician base" showDirections={false} /></section>
      </div>

      <section>
        <h2 className="section-title mb-3">Recent jobs <span className="text-sm font-normal text-ink-500">({Object.entries(js).map(([k, v]) => `${v} ${k.toLowerCase().replace('_', ' ')}`).join(', ') || 'none'})</span></h2>
        {data.recentJobs.length === 0 ? <p className="text-sm text-ink-500">No jobs yet.</p> : (
          <div className="table-wrap"><table className="table"><thead><tr><th>#</th><th>Service</th><th>When</th><th>Amount</th><th>Status</th><th /></tr></thead><tbody>{data.recentJobs.map((j) => (
            <tr key={j._id}><td className="font-semibold">{j.requestNumber}</td><td>{j.serviceName}</td><td>{dateTime(j.scheduledAt)}</td><td>{j.finalAmount != null ? inr(j.finalAmount) : '—'}</td><td><StatusBadge status={j.status} /></td><td className="text-right"><Link className="font-semibold text-brand-700 hover:underline" to={`/admin/requests/${j._id}`}>Open</Link></td></tr>))}</tbody></table></div>
        )}
      </section>

      <section>
        <h2 className="section-title mb-3">Recent reviews</h2>
        {data.ratings.length ? <div className="grid gap-3 md:grid-cols-2">{data.ratings.map((r, i) => <div key={i} className="card p-4"><Stars value={r.rating} showNumber={false} />{r.comment && <p className="mt-1 text-sm">“{r.comment}”</p>}<p className="mt-1 text-xs text-ink-500">{r.customer} · {dateOnly(r.createdAt)}</p></div>)}</div> : <p className="text-sm text-ink-500">No reviews yet.</p>}
      </section>

      {view && <DocViewer technicianId={t._id} doc={view.doc} label={`${view.label} — ${t.name}`} onClose={() => setView(null)} />}
      <TechnicianFormModal open={edit} technician={t} services={services.data ? services.data.services : []} onClose={() => setEdit(false)} onSaved={() => reload(false)} />
    </div>
  );
}
