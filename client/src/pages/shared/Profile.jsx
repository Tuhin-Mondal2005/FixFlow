import { useState } from 'react';
import { MapPicker } from '../../components/Maps';
import { Field, Spinner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api, { errMsg, tokenStore } from '../../services/api';
import { validatePassword, validatePhone } from '../../utils/validators';

export default function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: user.name, phone: user.phone });
  const [geo, setGeo] = useState({ latitude: user.address?.latitude ?? '', longitude: user.address?.longitude ?? '', address: user.address?.line || '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [pwErr, setPwErr] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    const er = {};
    if (form.name.trim().length < 2) er.name = 'Enter your name';
    const ph = validatePhone(form.phone); if (ph) er.phone = ph;
    if (geo.address.trim().length < 5) er.address = 'Enter your address';
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      const body = { name: form.name.trim(), phone: form.phone.trim(), address: geo.address.trim() };
      if (geo.latitude !== '' && geo.longitude !== '') { body.latitude = Number(geo.latitude); body.longitude = Number(geo.longitude); }
      const { data } = await api.put('/auth/profile', body);
      setUser(data.user);
      toast.success('Profile updated');
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };

  const changePw = async (e) => {
    e.preventDefault();
    const m = validatePassword(pw.newPassword);
    if (m) return setPwErr(m);
    setPwErr(''); setPwBusy(true);
    try { const { data } = await api.put('/auth/password', pw); tokenStore.set(data.token); setPw({ currentPassword: '', newPassword: '' }); toast.success('Password changed'); } catch (err) { setPwErr(errMsg(err)); } finally { setPwBusy(false); }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="page-title">My profile</h1>
      <form onSubmit={save} className="card-pad space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" error={errors.name} required><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Phone" error={errors.phone} required><input className="input" inputMode="numeric" maxLength={10} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        </div>
        <Field label="Email"><input className="input" value={user.email} disabled /></Field>
        <Field label="Default address" error={errors.address} required><textarea className="input" rows={2} value={geo.address} onChange={(e) => setGeo({ ...geo, address: e.target.value })} /></Field>
        <details><summary className="cursor-pointer text-sm font-semibold text-brand-700">Set home location on the map</summary><div className="mt-3"><MapPicker value={geo} onChange={setGeo} /></div></details>
        <button className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4" />} Save changes</button>
      </form>

      <form onSubmit={changePw} className="card-pad space-y-4" noValidate>
        <h2 className="font-bold">Change password</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Current password"><input className="input" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
          <Field label="New password" hint="8+ characters with a letter and a number"><input className="input" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
        </div>
        {pwErr && <p className="field-error">{pwErr}</p>}
        <button className="btn-outline" disabled={pwBusy}>{pwBusy && <Spinner className="h-4 w-4" />} Update password</button>
      </form>
    </div>
  );
}
