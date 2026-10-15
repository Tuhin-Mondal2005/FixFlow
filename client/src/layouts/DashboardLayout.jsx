import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import NotificationBell from '../components/NotificationBell';
import { useAuth } from '../context/AuthContext';

const NAV = {
  CUSTOMER: [
    { to: '/customer/dashboard', label: 'Dashboard', icon: '🏠' },
    { to: '/customer/request', label: 'Book a Service', icon: '➕' },
    { to: '/customer/requests', label: 'My Requests', icon: '📋' },
    { to: '/customer/history', label: 'Service History', icon: '🕘' },
    { to: '/customer/payment', label: 'Payments', icon: '💳' },
    { to: '/customer/rating', label: 'Ratings', icon: '⭐' },
    { to: '/customer/support', label: 'Support', icon: '🛟' },
    { to: '/customer/profile', label: 'Profile', icon: '👤' },
  ],
  TECHNICIAN: [
    { to: '/technician/dashboard', label: 'Dashboard', icon: '🏠' },
    { to: '/technician/jobs', label: 'Jobs', icon: '🧰' },
    { to: '/technician/availability', label: 'Availability', icon: '🟢' },
    { to: '/technician/earnings', label: 'Earnings', icon: '💰' },
    { to: '/technician/profile', label: 'Profile', icon: '👤' },
  ],
  ADMIN: [
    { to: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
    { to: '/admin/requests', label: 'Requests', icon: '📋' },
    { to: '/admin/technicians', label: 'Technicians', icon: '🧰' },
    { to: '/admin/technicians/pending', label: 'Verification', icon: '🛡️' },
    { to: '/admin/services', label: 'Services & Pricing', icon: '🏷️' },
    { to: '/admin/payments', label: 'Payments', icon: '💳' },
    { to: '/admin/support', label: 'Support', icon: '🛟' },
    { to: '/admin/audit', label: 'Audit Log', icon: '📜' },
    { to: '/admin/settings', label: 'Settings', icon: '⚙️' },
  ],
};
// 4 most important entries for the compact bottom bar on phones
const BOTTOM = { CUSTOMER: [0, 1, 2, 4], TECHNICIAN: [0, 1, 2, 3], ADMIN: [0, 1, 2, 3] };

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [drawer, setDrawer] = useState(false);
  const items = NAV[user.role];
  const roleLabel = { CUSTOMER: 'Customer', TECHNICIAN: 'Technician', ADMIN: 'Admin / Dispatcher' }[user.role];

  useEffect(() => { setDrawer(false); window.scrollTo(0, 0); }, [loc.pathname]);

  const link = ({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-slate-100'}`;
  const doLogout = () => { logout(); navigate('/'); };

  const Sidebar = (
    <div className="flex h-full flex-col">
      <div className="hidden h-16 items-center px-5 lg:flex"><Logo to="/" /></div>
      <div className="px-5 pb-3 pt-4 lg:pt-0">
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="truncate text-sm font-semibold">{user.name}</div>
          <div className="text-xs text-ink-500">{roleLabel}</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Dashboard">
        {items.map((i) => <NavLink key={i.to} to={i.to} end={i.to.split('/').length <= 3 && i.to.endsWith('technicians')} className={link}><span aria-hidden="true">{i.icon}</span>{i.label}</NavLink>)}
      </nav>
      <div className="border-t border-slate-100 p-3"><button onClick={doLogout} className="btn-ghost w-full justify-start text-red-600">↩ Log out</button></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">{Sidebar}</aside>

      {/* Tablet / mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] animate-fadeIn bg-white shadow-2xl">
            <div className="flex h-16 items-center justify-between px-4"><Logo to="/" /><button className="h-11 w-11 rounded-xl text-xl hover:bg-slate-100" onClick={() => setDrawer(false)} aria-label="Close menu">✕</button></div>
            {Sidebar}
          </aside>
        </div>
      )}

      <div className="min-w-0 lg:pl-64">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <button className="flex h-11 w-11 items-center justify-center rounded-xl text-2xl hover:bg-slate-100 lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu">☰</button>
            <div className="lg:hidden"><Logo to="/" /></div>
          </div>
          <div className="flex items-center gap-1">
            {user.role === 'CUSTOMER' && <Link to="/customer/request" className="btn-primary btn-sm mr-2 hidden sm:inline-flex">Book a Service</Link>}
            <NotificationBell />
          </div>
        </header>

        <main className="min-w-0 px-4 pb-28 pt-6 sm:px-6 lg:pb-10"><div className="mx-auto min-w-0 max-w-7xl animate-fadeIn"><Outlet /></div></main>
      </div>

      {/* Compact bottom navigation on phones */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Quick navigation">
        {BOTTOM[user.role].map((idx) => {
          const i = items[idx];
          return (
            <NavLink key={i.to} to={i.to} className={({ isActive }) => `flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${isActive ? 'text-brand-700' : 'text-ink-500'}`}>
              <span className="text-xl" aria-hidden="true">{i.icon}</span><span className="max-w-full truncate px-1">{i.label.split(' ')[0]}</span>
            </NavLink>
          );
        })}
        <button onClick={() => setDrawer(true)} className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-ink-500"><span className="text-xl" aria-hidden="true">☰</span>More</button>
      </nav>
    </div>
  );
}
