import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapPicker } from '../../components/Maps';
import { ErrorBox, Field, PageLoader, Spinner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useAsync';
import api, { errMsg } from '../../services/api';
import { CATEGORY_LABEL, inr, todayStr } from '../../utils/format';
import { validatePhone } from '../../utils/validators';

const URGENCIES = [
  { key: 'LOW', label: 'Low', hint: 'Whenever convenient', tone: 'border-slate-300' },
  { key: 'MEDIUM', label: 'Medium', hint: 'Within the day', tone: 'border-amber-400' },
  { key: 'HIGH', label: 'High — Emergency', hint: 'Processed first', tone: 'border-red-500' },
];

export default function BookRequest() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data, loading, error, reload } = useFetch('/services');

  const [form, setForm] = useState({
    serviceId: params.get('service') || '',
    packageName: '',
    problemDescription: '',
    urgency: ['LOW', 'MEDIUM', 'HIGH'].includes(params.get('urgency')) ? params.get('urgency') : 'MEDIUM',
    preferredDate: todayStr(),
    preferredTime: '10:00',
    contactNumber: user.phone || '',
  });
  const [geo, setGeo] = useState({
    latitude: user.address && user.address.latitude !== undefined ? user.address.latitude : '',
    longitude: user.address && user.address.longitude !== undefined ? user.address.longitude : '',
    address: (user.address && user.address.line) || '',
  });
  const [errors, setErrors] = useState({});
  const [serverErr, setServerErr] = useState('');
  const [busy, setBusy] = useState(false);

  const services = data ? data.services : [];
  const service = useMemo(() => services.find((s) => s._id === form.serviceId), [services, form.serviceId]);
  const price = service ? (form.packageName ? (service.packages.find((p) => p.name === form.packageName) || {}).price : service.startingPrice) : null;

  useEffect(() => { if (service && form.packageName && !service.packages.some((p) => p.name === form.packageName)) setForm((f) => ({ ...f, packageName: '' })); }, [service, form.packageName]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const validate = () => {
    const er = {};
    if (!form.serviceId) er.serviceId = 'Choose a service';
    if (form.problemDescription.trim().length < 10) er.problemDescription = 'Describe the problem (at least 10 characters)';
    if (geo.latitude === '' || geo.longitude === '') er.location = 'Share or select the service location';
    if (!geo.address || geo.address.trim().length < 5) er.address = 'Enter the full service address';
    if (!form.preferredDate) er.preferredDate = 'Choose a date';
    else if (form.preferredDate < todayStr()) er.preferredDate = 'Date cannot be in the past';
    if (!form.preferredTime) er.preferredTime = 'Choose a time';
    const ph = validatePhone(form.contactNumber); if (ph) er.contactNumber = ph;
    setErrors(er);
    return Object.keys(er).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    setServerErr('');
    if (!validate()) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    setBusy(true);
    try {
      const { data: res } = await api.post('/requests', { ...form, problemDescription: form.problemDescription.trim(), address: geo.address.trim(), latitude: Number(geo.latitude), longitude: Number(geo.longitude), contactNumber: form.contactNumber.trim() });
      toast.success(`Request #${res.request.requestNumber} submitted`);
      navigate(`/customer/request/${res.request._id}`);
    } catch (e2) { setServerErr(errMsg(e2)); window.scrollTo({ top: 0, behavior: 'smooth' }); } finally { setBusy(false); }
  };

  if (loading) return <PageLoader />;
  const grouped = Object.keys(CATEGORY_LABEL).map((c) => ({ c, items: services.filter((s) => s.category === c) }));

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-6" noValidate>
      <div><h1 className="page-title">Book a service</h1><p className="text-ink-500">Tell us what's wrong — we'll match the best verified technician near you.</p></div>
      <ErrorBox message={error} onRetry={reload} />
      {serverErr && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{serverErr}</p>}

      <section className="card-pad space-y-4">
        <h2 className="font-bold">1 · Service</h2>
        <Field label="Service type" error={errors.serviceId} required>
          <select className="input" value={form.serviceId} onChange={set('serviceId')}>
            <option value="">Select a service…</option>
            {grouped.map((g) => g.items.length > 0 && <optgroup key={g.c} label={CATEGORY_LABEL[g.c]}>{g.items.map((s) => <option key={s._id} value={s._id}>{s.name} — from {inr(s.startingPrice)}</option>)}</optgroup>)}
          </select>
        </Field>
        {service && service.packages.length > 0 && (
          <Field label="Package (level of service)">
            <div className="grid gap-2 sm:grid-cols-3">
              {service.packages.map((p) => (
                <label key={p.name} className={`cursor-pointer rounded-xl border-2 p-3 text-center transition ${form.packageName === p.name ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <input type="radio" name="pkg" className="sr-only" checked={form.packageName === p.name} onChange={() => setForm({ ...form, packageName: p.name })} />
                  <div className="font-semibold">{p.name}</div><div className="text-lg font-bold">{inr(p.price)}</div>
                </label>
              ))}
            </div>
            <button type="button" className="mt-1 text-xs text-ink-500 underline" onClick={() => setForm({ ...form, packageName: '' })}>Clear package</button>
          </Field>
        )}
        <Field label="Problem description" error={errors.problemDescription} required><textarea className="input" rows={3} maxLength={1000} placeholder="e.g. AC is not cooling, makes a loud noise" value={form.problemDescription} onChange={set('problemDescription')} /></Field>
        {service && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Service only: if a spare part or replacement item is needed, you arrange it. Estimated price: <b>{inr(price)}</b> (final bill is set by the technician after the job).</p>}
      </section>

      <section className="card-pad space-y-4">
        <h2 className="font-bold">2 · Urgency</h2>
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Urgency">
          {URGENCIES.map((u) => (
            <label key={u.key} className={`cursor-pointer rounded-xl border-2 p-3 transition ${form.urgency === u.key ? `${u.tone} bg-slate-50 ring-2 ring-brand-200` : 'border-slate-200 hover:border-slate-300'}`}>
              <input type="radio" name="urgency" className="sr-only" checked={form.urgency === u.key} onChange={() => setForm({ ...form, urgency: u.key })} />
              <div className="font-semibold">{u.key === 'HIGH' ? '🚨 ' : ''}{u.label}</div><div className="text-xs text-ink-500">{u.hint}</div>
            </label>
          ))}
        </div>
      </section>

      <section className="card-pad space-y-4">
        <h2 className="font-bold">3 · When</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Preferred date" error={errors.preferredDate} required><input className="input" type="date" min={todayStr()} value={form.preferredDate} onChange={set('preferredDate')} /></Field>
          <Field label="Preferred time" error={errors.preferredTime} required><input className="input" type="time" value={form.preferredTime} onChange={set('preferredTime')} /></Field>
        </div>
      </section>

      <section className="card-pad space-y-4">
        <h2 className="font-bold">4 · Where</h2>
        <MapPicker value={geo} onChange={setGeo} error={errors.location} />
        <Field label="Full address (flat, street, landmark)" error={errors.address} required><textarea className="input" rows={2} value={geo.address} onChange={(e) => setGeo({ ...geo, address: e.target.value })} /></Field>
        <Field label="Contact number" error={errors.contactNumber} required><input className="input" inputMode="numeric" maxLength={10} value={form.contactNumber} onChange={set('contactNumber')} /></Field>
      </section>

      <button className="btn-primary btn-lg w-full" disabled={busy}>{busy && <Spinner className="h-4 w-4" />} {form.urgency === 'HIGH' ? '🚨 Submit emergency request' : 'Submit request'}</button>
    </form>
  );
}
