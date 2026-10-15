import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { MapPicker } from '../../components/Maps';
import { Field, Spinner } from '../../components/ui';
import { HOME_BY_ROLE, useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api, { errMsg } from '../../services/api';
import { validatePassword, validatePhone, validateEmail } from '../../utils/validators';

export default function Register() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '', address: '' });
  const [geo, setGeo] = useState({ latitude: '', longitude: '', address: '' });
  const [showMap, setShowMap] = useState(true);
  const [errors, setErrors] = useState({});
  const [serverErr, setServerErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={HOME_BY_ROLE[user.role]} replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const validate = () => {
    const er = {};
    if (form.name.trim().length < 2) er.name = 'Enter your full name';
    const em = validateEmail(form.email); if (em) er.email = em;
    const ph = validatePhone(form.phone); if (ph) er.phone = ph;
    const pw = validatePassword(form.password); if (pw) er.password = pw;
    if (form.confirm !== form.password) er.confirm = 'Passwords do not match';
    if (form.address.trim().length < 5) er.address = 'Enter your address';
    if (geo.latitude === '' || geo.longitude === '') er.location = 'Please share your current location on the map';
    setErrors(er);
    return Object.keys(er).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    setServerErr('');
    if (!validate()) return;
    setBusy(true);
    try {
      const body = { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), password: form.password, address: form.address.trim() };
      body.latitude = Number(geo.latitude);
      body.longitude = Number(geo.longitude);
      await api.post('/auth/register', body);
      toast.success('Registration successful. Please log in.');
      navigate('/login', { state: { registered: true } });
    } catch (e2) { setServerErr(errMsg(e2)); } finally { setBusy(false); }
  };

  return (
    <div className="container-app flex justify-center py-12">
      <form onSubmit={submit} className="card-pad w-full max-w-xl space-y-4" noValidate>
        <div><h1 className="page-title">Create your account</h1><p className="mt-1 text-sm text-ink-500">Register → Login → Customer dashboard.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" error={errors.name} required><input className="input" autoComplete="name" value={form.name} onChange={set('name')} /></Field>
          <Field label="Phone number" error={errors.phone} required><input className="input" inputMode="numeric" maxLength={10} autoComplete="tel" value={form.phone} onChange={set('phone')} placeholder="10-digit mobile" /></Field>
        </div>
        <Field label="Email" error={errors.email} required><input className="input" type="email" autoComplete="email" value={form.email} onChange={set('email')} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Password" error={errors.password} hint="8+ characters with a letter and a number" required><input className="input" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} /></Field>
          <Field label="Confirm password" error={errors.confirm} required><input className="input" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} /></Field>
        </div>
        <Field label="Address" error={errors.address} required>
          <textarea className="input" rows={2} autoComplete="street-address" value={form.address} onChange={set('address')} />
        </Field>
        <div>
          <p className="mb-2 text-sm font-medium text-ink-700">📍 Share your current location on the map <span className="text-red-600">*</span></p>
          {showMap && <div className="mt-2"><MapPicker value={geo} error={errors.location} onChange={(g) => { setGeo(g); setErrors((er) => ({ ...er, location: undefined })); if (g.address && !form.address.trim()) setForm((f) => ({ ...f, address: g.address })); }} /></div>}
        </div>
        {serverErr && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{serverErr}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy && <Spinner className="h-4 w-4" />} Create account</button>
        <p className="text-center text-sm text-ink-500">Already registered? <Link to="/login" className="font-semibold text-brand-700 hover:underline">Log in</Link></p>
      </form>
    </div>
  );
}
