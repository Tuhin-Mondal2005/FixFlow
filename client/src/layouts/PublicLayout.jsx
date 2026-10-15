import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import Logo from '../components/Logo';
import { HOME_BY_ROLE, useAuth } from '../context/AuthContext';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/services', label: 'Services' },
  { to: '/how-it-works', label: 'How It Works' },
  { to: '/become-technician', label: 'Become a Technician' },
];

function Navbar() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => { setOpen(false); }, [loc.pathname]);
  const cls = ({ isActive }) => `rounded-lg px-3 py-2 text-sm font-semibold transition ${isActive ? 'text-brand-700' : 'text-ink-700 hover:text-brand-700'}`;

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="container-app flex h-16 items-center justify-between">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {LINKS.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={cls}>{l.label}</NavLink>)}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <Link to={HOME_BY_ROLE[user.role]} className="btn-primary">My Dashboard</Link>
          ) : (
            <>
              <Link to="/login" className="btn-ghost">Login</Link>
              <Link to="/register" className="btn-primary">Register</Link>
            </>
          )}
        </div>
        <button className="flex h-11 w-11 items-center justify-center rounded-xl text-2xl hover:bg-slate-100 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}>{open ? '✕' : '☰'}</button>
      </div>
      {open && (
        <div className="animate-fadeIn border-t border-slate-100 bg-white px-4 pb-4 md:hidden">
          <nav className="flex flex-col py-2" aria-label="Mobile">
            {LINKS.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `rounded-lg px-3 py-3 font-semibold ${isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-700'}`}>{l.label}</NavLink>)}
          </nav>
          <div className="grid grid-cols-2 gap-2">
            {user ? <Link to={HOME_BY_ROLE[user.role]} className="btn-primary col-span-2">My Dashboard</Link> : (
              <><Link to="/login" className="btn-outline">Login</Link><Link to="/register" className="btn-primary">Register</Link></>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-16 bg-ink-900 text-slate-300">
      <div className="container-app grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo light />
          <p className="mt-3 text-sm text-slate-400">Smart hyperlocal home services. We connect you with verified local technicians using skill, availability, distance, workload and rating based matching.</p>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-white">Platform</h4>
          <ul className="space-y-2 text-sm"><li><Link to="/services" className="hover:text-white">Services</Link></li><li><Link to="/how-it-works" className="hover:text-white">How it works</Link></li><li><Link to="/become-technician" className="hover:text-white">Become a technician</Link></li></ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-white">Accounts</h4>
          <ul className="space-y-2 text-sm"><li><Link to="/login" className="hover:text-white">Customer login</Link></li><li><Link to="/technician/login" className="hover:text-white">Technician login</Link></li><li><Link to="/admin/login" className="hover:text-white">Admin login</Link></li></ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-white">Good to know</h4>
          <p className="text-sm text-slate-400">FixFlow is a <strong className="text-slate-200">service-only</strong> platform. We do not sell products or spare parts — if a replacement part is needed, the customer arranges it. Listed prices are demo values.</p>
        </div>
      </div>
    </footer>
  );
}

export default function PublicLayout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1"><Outlet /></main>
      <Footer />
    </div>
  );
}
