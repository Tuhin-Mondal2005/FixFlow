import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Field, Spinner } from '../../components/ui';
import { HOME_BY_ROLE, useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { errMsg } from '../../services/api';

const COPY = {
  CUSTOMER: { title: 'Welcome back', sub: 'Log in to book and track your services.' },
  TECHNICIAN: { title: 'Technician login', sub: 'Approved technicians can log in to manage jobs and earnings.' },
  ADMIN: { title: 'Admin / dispatcher login', sub: 'Restricted area for FixFlow staff.' },
};

export default function Login({ portal = 'CUSTOMER' }) {
  const { user, login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const loc = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const c = COPY[portal];

  if (user) return <Navigate to={HOME_BY_ROLE[user.role]} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!form.email.trim() || !form.password) return setErr('Enter your email and password.');
    setBusy(true);
    try {
      const u = await login(form.email.trim(), form.password, portal);
      toast.success(`Welcome, ${u.name.split(' ')[0]}!`);
      const from = loc.state && loc.state.from;
      navigate(from && from.startsWith(`/${u.role.toLowerCase()}`) ? from : HOME_BY_ROLE[u.role], { replace: true });
    } catch (e2) {
      setErr(errMsg(e2, 'Login failed'));
    } finally { setBusy(false); }
  };

  return (
    <div className="container-app flex justify-center py-12">
      <div className="w-full max-w-md">
        <div className="card-pad">
          <h1 className="page-title">{c.title}</h1>
          <p className="mt-1 text-sm text-ink-500">{c.sub}</p>
          {loc.state && loc.state.registered && <p className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">Registration successful. Please log in.</p>}
          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <Field label="Email" required><input className="input" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Password" required><input className="input" type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
            {err && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{err}</p>}
            <button className="btn-primary w-full" disabled={busy}>{busy && <Spinner className="h-4 w-4" />} Log in</button>
          </form>
          {portal === 'CUSTOMER' && <p className="mt-5 text-center text-sm text-ink-500">New to FixFlow? <Link to="/register" className="font-semibold text-brand-700 hover:underline">Create an account</Link></p>}
          {portal === 'TECHNICIAN' && <p className="mt-5 text-center text-sm text-ink-500">Not a technician yet? <Link to="/technician/register" className="font-semibold text-brand-700 hover:underline">Apply to join</Link></p>}
        </div>
        <p className="mt-4 text-center text-xs text-ink-500">
          {portal !== 'CUSTOMER' && <Link to="/login" className="hover:underline">Customer login</Link>}
          {portal === 'CUSTOMER' && <><Link to="/technician/login" className="hover:underline">Technician login</Link> · <Link to="/admin/login" className="hover:underline">Admin login</Link></>}
        </p>
      </div>
    </div>
  );
}
