import { useState } from 'react';
import { Link } from 'react-router-dom';
import DocViewer from '../../components/DocViewer';
import { ConfirmModal, EmptyState, ErrorBox, Field, PageLoader } from '../../components/ui';
import { useLiveRefresh } from '../../context/RealtimeContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useAsync';
import api, { errMsg } from '../../services/api';
import { dateOnly } from '../../utils/format';

export default function PendingTechnicians() {
  const toast = useToast();
  const { data, loading, error, reload } = useFetch('/admin/technicians', { verificationStatus: 'PENDING', limit: 50 });
  const services = useFetch('/services');
  useLiveRefresh(reload, ['admin:event']);
  const [view, setView] = useState(null); // { techId, doc, label }
  const [reject, setReject] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');

  const names = Object.fromEntries((services.data ? services.data.services : []).map((s) => [s.slug, s.name]));

  const approve = async (t) => {
    setBusy(t._id);
    try { await api.put(`/admin/technicians/${t._id}/approve`); toast.success(`${t.name} approved — now ACTIVE`); reload(false); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(''); }
  };
  const doReject = async () => {
    if (reason.trim().length < 3) return toast.error('Enter a reason (at least 3 characters)');
    setBusy(reject._id);
    try { await api.put(`/admin/technicians/${reject._id}/reject`, { reason }); toast.success('Application rejected'); setReject(null); setReason(''); reload(false); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(''); }
  };

  if (loading) return <PageLoader />;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="page-title">Pending verification</h1><p className="text-ink-500">Review documents, then approve (PENDING → ACTIVE) or reject (PENDING → REJECTED).</p></div><Link to="/admin/technicians" className="btn-outline">All technicians</Link></div>
      <ErrorBox message={error} onRetry={reload} />
      {data && data.technicians.length === 0 ? <EmptyState icon="🛡️" title="Nothing to review" text="New technician applications will show up here." /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data && data.technicians.map((t) => (
            <article key={t._id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {t.profilePhoto ? <img src={t.profilePhoto} alt="" className="h-14 w-14 rounded-full object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700">{t.name[0]}</div>}
                  <div><h2 className="text-lg font-bold">{t.name}</h2><div className="text-sm text-ink-500">Applied {dateOnly(t.createdAt)}</div></div>
                </div>
                <span className="badge bg-amber-100 text-amber-800">PENDING</span>
              </div>
              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-ink-500">Phone</dt><dd>{t.phone}</dd></div>
                <div><dt className="text-xs text-ink-500">Email</dt><dd className="truncate">{t.email}</dd></div>
                <div><dt className="text-xs text-ink-500">Experience</dt><dd>{t.experience} years</dd></div>
                <div><dt className="text-xs text-ink-500">Aadhaar</dt><dd>{t.aadhaarMasked}</dd></div>
                <div className="sm:col-span-2"><dt className="text-xs text-ink-500">Skills</dt><dd>{t.skills.map((s) => names[s] || s).join(', ')}</dd></div>
                <div className="sm:col-span-2"><dt className="text-xs text-ink-500">Certifications</dt><dd>{t.certifications.length ? t.certifications.join(', ') : '—'}</dd></div>
                <div className="sm:col-span-2"><dt className="text-xs text-ink-500">Location</dt><dd>{t.location.address}</dd></div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                {t.documents.aadhaar && <button className="btn-outline btn-sm" onClick={() => setView({ techId: t._id, doc: { kind: 'aadhaar', index: 0 }, label: `Aadhaar — ${t.name}` })}>🪪 Aadhaar document</button>}
                {t.documents.qualification.map((d, i) => <button key={d.id} className="btn-outline btn-sm" onClick={() => setView({ techId: t._id, doc: { kind: 'qualification', index: i }, label: `Certificate ${i + 1} — ${t.name}` })}>📄 Certificate {i + 1}</button>)}
              </div>
              <div className="mt-5 flex gap-2">
                <button className="btn-primary flex-1" disabled={busy === t._id} onClick={() => approve(t)}>✔ Approve</button>
                <button className="btn-danger flex-1" disabled={busy === t._id} onClick={() => setReject(t)}>✕ Reject</button>
              </div>
            </article>
          ))}
        </div>
      )}
      {view && <DocViewer technicianId={view.techId} doc={view.doc} label={view.label} onClose={() => setView(null)} />}
      <ConfirmModal open={Boolean(reject)} onClose={() => setReject(null)} danger busy={Boolean(busy)} title={`Reject ${reject ? reject.name : ''}?`} message="The technician will see the reason when they try to log in." confirmLabel="Reject application" onConfirm={doReject}>
        <div className="mt-3"><Field label="Reason" required><input className="input" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Aadhaar image is unreadable" /></Field></div>
      </ConfirmModal>
    </div>
  );
}
