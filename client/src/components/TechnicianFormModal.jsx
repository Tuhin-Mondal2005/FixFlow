import { useEffect, useMemo, useState } from 'react';
import { MapPicker } from './Maps';
import { Field, Modal, Spinner } from './ui';
import { useToast } from '../context/ToastContext';
import api, { errMsg } from '../services/api';
import { CATEGORY_LABEL } from '../utils/format';
import { validateEmail, validatePassword, validatePhone } from '../utils/validators';

/** Admin: add a technician (pre-verified) or edit an existing one. */
export default function TechnicianFormModal({ open, onClose, technician, services, onSaved }) {
  const toast = useToast();
  const editing = Boolean(technician);
  const blank = { name: '', email: '', phone: '', password: '', experience: 0, certifications: '', serviceRadiusKm: 15 };
  const [form, setForm] = useState(blank);
  const [geo, setGeo] = useState({ latitude: '', longitude: '', address: '' });
  const [skills, setSkills] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (technician) {
      setForm({ name: technician.name, email: technician.email || '', phone: technician.phone, password: '', experience: technician.experience, certifications: (technician.certifications || []).join(', '), serviceRadiusKm: technician.serviceRadiusKm });
      setGeo({ latitude: technician.location.latitude, longitude: technician.location.longitude, address: technician.location.address });
      setSkills(technician.skills);
    } else { setForm(blank); setGeo({ latitude: '', longitude: '', address: '' }); setSkills([]); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, technician && technician._id]);

  const groups = useMemo(() => Object.keys(CATEGORY_LABEL).map((c) => ({ c, items: services.filter((s) => s.category === c) })), [services]);
  const toggle = (slug) => setSkills((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug]));

  const save = async () => {
    const problems = [];
    if (form.name.trim().length < 2) problems.push('Enter a name');
    const ph = validatePhone(form.phone); if (ph) problems.push(ph);
    const em = validateEmail(form.email); if (em) problems.push(em);
    if (!editing) { const pw = validatePassword(form.password); if (pw) problems.push(pw); }
    if (geo.latitude === '' || geo.longitude === '' || geo.address.trim().length < 5) problems.push('Pick a location and address');
    if (!skills.length) problems.push('Select at least one skill');
    if (problems.length) return toast.error(problems[0]);
    setBusy(true);
    try {
      const body = { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), address: geo.address.trim(), latitude: Number(geo.latitude), longitude: Number(geo.longitude), skills, experience: Number(form.experience), certifications: form.certifications, serviceRadiusKm: Number(form.serviceRadiusKm) };
      if (editing) await api.put(`/admin/technicians/${technician._id}`, body);
      else await api.post('/admin/technicians', { ...body, password: form.password });
      toast.success(editing ? 'Technician updated' : 'Technician added');
      onSaved(); onClose();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit ${technician.name}` : 'Add technician'} wide
      footer={<><button className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner className="h-4 w-4" />} {editing ? 'Save changes' : 'Add technician'}</button></>}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Phone" required><input className="input" inputMode="numeric" maxLength={10} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Email" required><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          {!editing && <Field label="Initial password" hint="8+ chars, letter and number" required><input className="input" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>}
          <Field label="Experience (years)"><input className="input" type="number" min="0" max="60" value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })} /></Field>
          <Field label="Service radius (km)"><input className="input" type="number" min="1" max="100" value={form.serviceRadiusKm} onChange={(e) => setForm({ ...form, serviceRadiusKm: e.target.value })} /></Field>
        </div>
        <Field label="Certifications" hint="Comma separated"><input className="input" value={form.certifications} onChange={(e) => setForm({ ...form, certifications: e.target.value })} /></Field>
        {groups.map((g) => g.items.length > 0 && (
          <fieldset key={g.c}><legend className="mb-2 text-sm font-semibold text-ink-700">{CATEGORY_LABEL[g.c]}</legend>
            <div className="flex flex-wrap gap-2">{g.items.map((s) => (
              <label key={s._id} className={`cursor-pointer select-none rounded-full border px-3 py-1.5 text-sm transition ${skills.includes(s.slug) ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 bg-white text-ink-700'}`}>
                <input type="checkbox" className="sr-only" checked={skills.includes(s.slug)} onChange={() => toggle(s.slug)} />{s.name}</label>))}</div></fieldset>
        ))}
        <MapPicker value={geo} onChange={setGeo} />
        <Field label="Address" required><input className="input" value={geo.address} onChange={(e) => setGeo({ ...geo, address: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
