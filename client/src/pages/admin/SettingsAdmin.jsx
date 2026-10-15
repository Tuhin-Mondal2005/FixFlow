import { useEffect, useState } from 'react';
import { ErrorBox, Field, PageLoader, Spinner } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useAsync';
import api, { errMsg } from '../../services/api';
import { CATEGORY_LABEL } from '../../utils/format';

const WEIGHTS = [['skill', 'Skill match'], ['availability', 'Availability'], ['location', 'Distance'], ['workload', 'Workload'], ['rating', 'Rating'], ['experience', 'Experience']];

export default function SettingsAdmin() {
  const toast = useToast();
  const { data, loading, error, reload } = useFetch('/admin/settings');
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setS(JSON.parse(JSON.stringify(data.settings))); }, [data]);
  if (loading || !s) return error ? <ErrorBox message={error} onRetry={reload} /> : <PageLoader />;

  const total = WEIGHTS.reduce((n, [k]) => n + Number(s.assignmentWeights[k] || 0), 0);
  const nested = (group, key) => (e) => setS({ ...s, [group]: { ...s[group], [key]: e.target.value } });
  const flat = (key) => (e) => setS({ ...s, [key]: e.target.value });

  const save = async () => {
    if (total <= 0) return toast.error('At least one scoring weight must be above zero');
    const n = (v) => Number(v);
    const body = {
      assignmentWeights: Object.fromEntries(WEIGHTS.map(([k]) => [k, n(s.assignmentWeights[k])])),
      commissionRates: Object.fromEntries(Object.keys(CATEGORY_LABEL).map((k) => [k, n(s.commissionRates[k])])),
      responseTimeoutMinutes: { LOW: n(s.responseTimeoutMinutes.LOW), MEDIUM: n(s.responseTimeoutMinutes.MEDIUM), HIGH: n(s.responseTimeoutMinutes.HIGH) },
      noShowGraceMinutes: n(s.noShowGraceMinutes), maxAutoAttempts: n(s.maxAutoAttempts), maxWorkload: n(s.maxWorkload),
      defaultServiceRadiusKm: n(s.defaultServiceRadiusKm), travelBufferMinutes: n(s.travelBufferMinutes), maxWaitMinutes: n(s.maxWaitMinutes),
    };
    setBusy(true);
    try { await api.put('/admin/settings', body); toast.success('Settings saved'); reload(false); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  const num = (label, key, hint, min = 0, max = 999) => <Field label={label} hint={hint}><input className="input" type="number" min={min} max={max} value={s[key]} onChange={flat(key)} /></Field>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="page-title">Platform settings</h1><p className="text-ink-500">Tune the assignment engine and commission without redeploying.</p></div>
        <button className="btn-primary" onClick={save} disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Save settings</button></div>

      <section className="card-pad space-y-4">
        <div><h2 className="font-bold">Assignment scoring weights</h2><p className="text-sm text-ink-500">Weights are relative; they are normalised so they need not add up to 100 (currently {total}).</p></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{WEIGHTS.map(([k, label]) => (
          <div key={k}><label className="label">{label} <b className="text-brand-700">{s.assignmentWeights[k]}</b>{total > 0 && <span className="text-xs text-ink-500"> ({Math.round((s.assignmentWeights[k] / total) * 100)}%)</span>}</label>
            <input type="range" min="0" max="100" className="w-full" value={s.assignmentWeights[k]} onChange={nested('assignmentWeights', k)} aria-label={label} /></div>))}</div>
      </section>

      <section className="card-pad space-y-4">
        <div><h2 className="font-bold">Commission by category (%)</h2><p className="text-sm text-ink-500">A service can override this on the Services page.</p></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(CATEGORY_LABEL).map(([k, label]) => <Field key={k} label={label}><input className="input" type="number" min="0" max="60" value={s.commissionRates[k]} onChange={nested('commissionRates', k)} /></Field>)}</div>
      </section>

      <section className="card-pad space-y-4">
        <div><h2 className="font-bold">Technician response time (minutes)</h2><p className="text-sm text-ink-500">After this long without a response, the offer times out and the next technician is tried.</p></div>
        <div className="grid gap-4 sm:grid-cols-3">{['LOW', 'MEDIUM', 'HIGH'].map((k) => <Field key={k} label={k === 'HIGH' ? 'HIGH (emergency)' : k}><input className="input" type="number" min="1" max="240" value={s.responseTimeoutMinutes[k]} onChange={nested('responseTimeoutMinutes', k)} /></Field>)}</div>
      </section>

      <section className="card-pad space-y-4">
        <h2 className="font-bold">Engine rules</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {num('Max active jobs per technician', 'maxWorkload', 'Workload cap', 1, 50)}
          {num('Max automatic attempts', 'maxAutoAttempts', 'Then escalated to admin', 1, 20)}
          {num('Default service radius (km)', 'defaultServiceRadiusKm', undefined, 1, 100)}
          {num('Travel buffer between jobs (min)', 'travelBufferMinutes', undefined, 0, 180)}
          {num('No-show grace (min)', 'noShowGraceMinutes', 'After the scheduled time', 5, 240)}
          {num('Max wait in queue (min)', 'maxWaitMinutes', 'Before the admin is alerted', 0, 720)}
        </div>
      </section>
    </div>
  );
}
