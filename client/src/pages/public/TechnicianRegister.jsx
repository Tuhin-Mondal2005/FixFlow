import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { MapPicker } from '../../components/Maps';
import { Field, Spinner } from '../../components/ui';
import { HOME_BY_ROLE, useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useAsync';
import api, { errMsg } from '../../services/api';
import { CATEGORY_LABEL } from '../../utils/format';
import { validateEmail, validateFile, validatePassword, validatePhone } from '../../utils/validators';
import { aadhaarError, formatAadhaar } from '../../utils/aadhaar';

export default function TechnicianRegister() {
  const { user } = useAuth();
  const { data } = useFetch('/services');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '', experience: 0, certifications: '', aadhaarNumber: '' });
  const [geo, setGeo] = useState({ latitude: '', longitude: '', address: '' });
  const [skills, setSkills] = useState([]);
  const [files, setFiles] = useState({ aadhaar: null, qualification: [], photo: null });
  const [errors, setErrors] = useState({});
  const [serverErr, setServerErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const groups = useMemo(() => {
    const all = data ? data.services : [];
    return Object.keys(CATEGORY_LABEL).map((c) => ({ c, items: all.filter((s) => s.category === c) }));
  }, [data]);

  if (user) return <Navigate to={HOME_BY_ROLE[user.role]} replace />;

  if (done) {
    return (
      <div className="container-app flex justify-center py-16">
        <div className="card-pad max-w-lg text-center">
          <div className="text-6xl" aria-hidden="true">📨</div>
          <h1 className="page-title mt-3">Application submitted</h1>
          <p className="mt-3 text-ink-700">Your status is <span className="badge bg-amber-100 text-amber-800">PENDING</span>. An administrator will review your Aadhaar and qualification documents. You can log in once you are approved.</p>
          <Link to="/" className="btn-primary mt-6">Back to home</Link>
        </div>
      </div>
    );
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const toggle = (slug) => setSkills((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug]));

  const validate = () => {
    const er = {};
    if (form.name.trim().length < 2) er.name = 'Enter your full name';
    const em = validateEmail(form.email); if (em) er.email = em;
    const ph = validatePhone(form.phone); if (ph) er.phone = ph;
    const pw = validatePassword(form.password); if (pw) er.password = pw;
    if (form.confirm !== form.password) er.confirm = 'Passwords do not match';
    if (geo.latitude === '' || geo.longitude === '') er.location = 'Pick your base location on the map (or enter coordinates)';
    if (!geo.address || geo.address.trim().length < 5) er.address = 'Enter your address / area';
    if (!skills.length) er.skills = 'Select at least one skill';
    if (form.experience === '' || Number(form.experience) < 0 || Number(form.experience) > 60) er.experience = 'Enter years of experience (0-60)';
    const an = aadhaarError(form.aadhaarNumber); if (an) er.aadhaarNumber = an;
    const a = validateFile(files.aadhaar); if (a) er.aadhaar = a;
    if (!files.qualification.length) er.qualification = 'Upload at least one certificate';
    else { const q = files.qualification.map((f) => validateFile(f)).find(Boolean); if (q) er.qualification = q; }
    if (files.photo) { const p = validateFile(files.photo, { imageOnly: true }); if (p) er.photo = p; }
    setErrors(er);
    if (Object.keys(er).length) window.scrollTo({ top: 0, behavior: 'smooth' });
    return Object.keys(er).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    setServerErr('');
    if (!validate()) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name.trim());
      fd.append('email', form.email.trim());
      fd.append('phone', form.phone.trim());
      fd.append('password', form.password);
      fd.append('address', geo.address.trim());
      fd.append('latitude', geo.latitude);
      fd.append('longitude', geo.longitude);
      fd.append('skills', JSON.stringify(skills));
      fd.append('experience', form.experience);
      fd.append('certifications', form.certifications);
      fd.append('aadhaarNumber', form.aadhaarNumber.replace(/\s/g, ''));
      fd.append('aadhaar', files.aadhaar);
      files.qualification.forEach((f) => fd.append('qualification', f));
      if (files.photo) fd.append('photo', files.photo);
      await api.post('/technicians/register', fd, { timeout: 60000 });
      setDone(true);
    } catch (e2) { setServerErr(errMsg(e2)); window.scrollTo({ top: 0, behavior: 'smooth' }); } finally { setBusy(false); }
  };

  return (
    <div className="container-app flex justify-center py-10">
      <form onSubmit={submit} className="w-full max-w-3xl space-y-6" noValidate>
        <div><h1 className="page-title">Become a FixFlow technician</h1><p className="mt-1 text-sm text-ink-500">Your application stays <b>Pending</b> until an admin verifies your documents.</p></div>
        {serverErr && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{serverErr}</p>}

        <section className="card-pad space-y-4">
          <h2 className="font-bold">Account</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" error={errors.name} required><input className="input" value={form.name} onChange={set('name')} autoComplete="name" /></Field>
            <Field label="Phone" error={errors.phone} required><input className="input" inputMode="numeric" maxLength={10} value={form.phone} onChange={set('phone')} /></Field>
          </div>
          <Field label="Email" error={errors.email} required><input className="input" type="email" value={form.email} onChange={set('email')} autoComplete="email" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Password" error={errors.password} hint="8+ characters with a letter and a number" required><input className="input" type="password" value={form.password} onChange={set('password')} autoComplete="new-password" /></Field>
            <Field label="Confirm password" error={errors.confirm} required><input className="input" type="password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" /></Field>
          </div>
        </section>

        <section className="card-pad space-y-4">
          <h2 className="font-bold">Base location</h2>
          <p className="text-sm text-ink-500">Used to match you with nearby customers (hyperlocal assignment).</p>
          <MapPicker value={geo} onChange={setGeo} error={errors.location} />
          <Field label="Address / area" error={errors.address} required><input className="input" value={geo.address} onChange={(e) => setGeo({ ...geo, address: e.target.value })} /></Field>
        </section>

        <section className="card-pad space-y-4">
          <h2 className="font-bold">Skills & experience</h2>
          {errors.skills && <p className="field-error">{errors.skills}</p>}
          {groups.map((g) => g.items.length > 0 && (
            <fieldset key={g.c}>
              <legend className="mb-2 text-sm font-semibold text-ink-700">{CATEGORY_LABEL[g.c]}</legend>
              <div className="flex flex-wrap gap-2">
                {g.items.map((s) => (
                  <label key={s._id} className={`cursor-pointer select-none rounded-full border px-3 py-2 text-sm font-medium transition ${skills.includes(s.slug) ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 bg-white text-ink-700 hover:bg-slate-50'}`}>
                    <input type="checkbox" className="sr-only" checked={skills.includes(s.slug)} onChange={() => toggle(s.slug)} />{s.icon} {s.name}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Years of experience" error={errors.experience} required><input className="input" type="number" min="0" max="60" value={form.experience} onChange={set('experience')} /></Field>
            <Field label="Certifications" hint="Comma separated, e.g. ITI Electrician, HVAC Diploma"><input className="input" value={form.certifications} onChange={set('certifications')} /></Field>
          </div>
        </section>

        <section className="card-pad space-y-4">
          <h2 className="font-bold">Documents</h2>
          <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">🔒 Documents are encrypted and visible only to administrators. Use <b>dummy documents</b> while testing. PDF / PNG / JPG, max 5 MB each.</div>
          <Field label="Aadhaar document" error={errors.aadhaar} required><input className="input" type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setFiles({ ...files, aadhaar: e.target.files[0] || null })} /></Field>
          <Field label="Aadhaar number (12 digits)" error={errors.aadhaarNumber} required hint="Stored encrypted. Only administrators can see the full number.">
            <input className="input max-w-xs" inputMode="numeric" autoComplete="off" placeholder="XXXX XXXX XXXX" value={form.aadhaarNumber} onChange={(e) => setForm({ ...form, aadhaarNumber: formatAadhaar(e.target.value) })} />
          </Field>
          <Field label="Qualification / certificate documents" error={errors.qualification} hint="You can select up to 4 files" required><input className="input" type="file" multiple accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setFiles({ ...files, qualification: Array.from(e.target.files).slice(0, 4) })} /></Field>
          <Field label="Profile photo (optional)" error={errors.photo}><input className="input" type="file" accept=".png,.jpg,.jpeg" onChange={(e) => setFiles({ ...files, photo: e.target.files[0] || null })} /></Field>
        </section>

        <button className="btn-primary btn-lg w-full" disabled={busy}>{busy && <Spinner className="h-4 w-4" />} Submit application</button>
        <p className="text-center text-sm text-ink-500">Already approved? <Link to="/technician/login" className="font-semibold text-brand-700 hover:underline">Technician login</Link></p>
      </form>
    </div>
  );
}
