import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRealtime } from '../context/RealtimeContext';
import { timeAgo } from '../utils/format';

export default function NotificationBell() {
  const { notifications, unread, markRead, markAllRead, connected } = useRealtime();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const openItem = (n) => {
    if (!n.isRead) markRead(n._id);
    setOpen(false);
    if (n.data && n.data.link) navigate(n.data.link);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="relative flex h-11 w-11 items-center justify-center rounded-xl hover:bg-slate-100" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open}>
        <span className="text-xl" aria-hidden="true">🔔</span>
        {unread > 0 && <span className="absolute right-1 top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
        <span className={`absolute bottom-1.5 right-1.5 h-2 w-2 rounded-full ring-2 ring-white ${connected ? 'bg-green-500' : 'bg-slate-300'}`} title={connected ? 'Live' : 'Reconnecting…'} />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(92vw,380px)] animate-fadeIn overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="font-semibold">Notifications</span>
            {unread > 0 && <button onClick={markAllRead} className="text-xs font-semibold text-brand-700 hover:underline">Mark all read</button>}
          </div>
          <ul className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto">
            {notifications.length === 0 && <li className="px-4 py-10 text-center text-sm text-ink-500">You're all caught up.</li>}
            {notifications.map((n) => (
              <li key={n._id}>
                <button onClick={() => openItem(n)} className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50 ${n.isRead ? '' : 'bg-brand-50/60'}`}>
                  {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{n.title}</span>
                    <span className="line-clamp-2 block text-sm text-ink-700">{n.message}</span>
                    <span className="text-xs text-ink-500">{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
