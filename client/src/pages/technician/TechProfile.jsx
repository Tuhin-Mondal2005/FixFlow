import { useEffect, useMemo, useState } from 'react';
import { MapPicker } from '../../components/Maps';
import { AvailabilityBadge, ErrorBox, Field, PageLoader, Spinner, Stars, VerifyBadge } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useAsync';
import api, { errMsg } from '../../services/api';
import { CATEGORY_LABEL, dateOnly } from '../../utils/format';
import { validatePhone, validateFile } from '../../utils/validators';

export default function TechProfile() {
  const toast = useToast();
  const profile = useFetch('/technicians/profile');
  const services = useFetch('/services');
  const ratings = useFetch('/technicians/ratings');
  const [form, setForm] = useState(null);
  const [geo, setGeo] = useState({ latitude: '', longitude: '', address: '' });
  const [skills, setSkills] = useState([]);
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const t = profile.data && profile.data.technician;

  useEffect(() => {
    if (!t) return;
    setForm({ name: t.name, phone: t.phone, experience: t.experience, certifications: (t.certifications || []).join(', '), serviceRadiusKm: t.serviceRadiusKm });
    setGeo({ latitude: t.location.latitude, longitude: t.location.longitude, address: t.location.address });
    setSkills(t.skills);
  }, [t && t._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => Object.keys(CATEGORY_LABEL).map((c) => ({ c, items: (services.data ? services.data.services : []).filter((s) => s.category === c) })), [services.data]);

  if (profile.loading || !form) return <PageLoader />;
  if (profile.error) return <ErrorBox message={profile.error} onRetry={profile.reload} />;

  const toggle = (slug) => setSkills((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug]));
  const save = async (e) => {
    e.preventDefault();
    const ph = validatePhone(form.phone); if (ph) return toast.error(ph);
    if (!skills.length) return toast.error('Select at least one skill');
    if (geo.latitude === '' || geo.longitude === '' || !geo.address) return toast.error('Location and address are required');
    if (photo) { const pe = validateFile(photo, { imageOnly: true }); if (pe) return toast.error(pe); }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name.trim()); fd.append('phone', form.phone.trim()); fd.append('address', geo.address.trim());
      fd.append('latitude', geo.latitude); fd.append('longitude', geo.longitude);
      fd.append('skills', JSON.stringify(skills)); fd.append('experience', form.experience); fd.append('certifications', form.certifications); fd.append('serviceRadiusKm', form.serviceRadiusKm);
      if (photo) fd.append('photo', photo);
      await api.put('/technicians/profile', fd);
      toast.success('Profile updated'); setPhoto(null); profile.reload(false);
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <form onSubmit={save} className="space-y-6">
        <h1 className="page-title">My profile</h1>
        <section className="card-pad space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Phone" required><input className="input" inputMode="numeric" maxLength={10} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Experience (years)"><input className="input" type="number" min="0" max="60" value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })} /></Field>
            <Field label="Service radius (km)" hint="How far you are willing to travel"><input className="input" type="number" min="1" max="100" value={form.serviceRadiusKm} onChange={(e) => setForm({ ...form, serviceRadiusKm: e.target.value })} /></Field>
          </div>
          <Field label="Certifications" hint="Comma separated"><input className="input" value={form.certifications} onChange={(e) => setForm({ ...form, certifications: e.target.value })} /></Field>
          <Field label="Profile photo"><input className="input" type="file" accept=".png,.jpg,.jpeg" onChange={(e) => setPhoto(e.target.files[0] || null)} /></Field>
        </section>
        <section className="card-pad space-y-3">
          <h2 className="font-bold">Skills</h2>
          {groups.map((g) => g.items.length > 0 && (
            <fieldset key={g.c}><legend className="mb-2 text-sm font-semibold text-ink-700">{CATEGORY_LABEL[g.c]}</legend>
              <div className="flex flex-wrap gap-2">{g.items.map((s) => (
                <label key={s._id} className={`cursor-pointer select-none rounded-full border px-3 py-2 text-sm font-medium transition ${skills.includes(s.slug) ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 bg-white text-ink-700 hover:bg-slate-50'}`}>
                  <input type="checkbox" className="sr-only" checked={skills.includes(s.slug)} onChange={() => toggle(s.slug)} />{s.icon} {s.name}</label>
              ))}</div></fieldset>
          ))}
        </section>
        <section className="card-pad space-y-3"><h2 className="font-bold">Base location</h2><MapPicker value={geo} onChange={setGeo} />
          <Field label="Address"><input className="input" value={geo.address} onChange={(e) => setGeo({ ...geo, address: e.target.value })} /></Field></section>
        <button className="btn-primary btn-lg" disabled={busy}>{busy && <Spinner className="h-4 w-4" />} Save profile</button>
      </form>

      <aside className="space-y-6 lg:pt-14">
        <section className="card-pad text-center">
          {t.profilePhoto ? <img src={t.profilePhoto} alt="" className="mx-auto h-24 w-24 rounded-full object-cover" /> : <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-brand-100 text-4xl font-bold text-brand-700">{t.name[0]}</div>}
          <div className="mt-3 text-lg font-bold">{t.name}</div>
          <div className="mt-1 flex justify-center gap-2"><VerifyBadge status={t.verificationStatus} /><AvailabilityBadge status={t.availabilityStatus} /></div>
          <div className="mt-3 flex justify-center"><Stars value={t.rating} count={t.ratingCount} /></div>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm"><div className="rounded-xl bg-slate-50 p-2"><dt className="text-xs text-ink-500">Completed jobs</dt><dd className="font-bold">{t.completedJobs}</dd></div><div className="rounded-xl bg-slate-50 p-2"><dt className="text-xs text-ink-500">Current jobs</dt><dd className="font-bold">{t.currentJobs}</dd></div></dl>
          <p className="mt-3 text-xs text-ink-500">Aadhaar on file: {t.aadhaarMasked}. Documents are private and only visible to administrators.</p>
        </section>
        <section className="card-pad"><h2 className="mb-3 font-bold">Recent reviews</h2>
          {ratings.data && ratings.data.ratings.length ? <ul className="space-y-3">{ratings.data.ratings.slice(0, 6).map((r, i) => (<li key={i} className="text-sm"><Stars value={r.rating} showNumber={false} size="text-sm" /><p>{r.comment ? `“${r.comment}”` : <span className="text-ink-500">No comment</span>}</p><p className="text-xs text-ink-500">{r.customer} · {r.service} · {dateOnly(r.createdAt)}</p></li>))}</ul> : <p className="text-sm text-ink-500">No reviews yet.</p>}
        </section>
      </aside>
    </div>
  );
}
