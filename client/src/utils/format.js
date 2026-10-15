export const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const dateTime = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
export const dateOnly = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const timeOnly = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—');

export function timeAgo(d) {
  if (!d) return '';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export const hhmmTo12 = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

export const todayStr = (offsetDays = 0) => {
  const d = new Date(Date.now() + offsetDays * 86400000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** value for <input type="datetime-local"> from a Date */
export const toLocalInput = (d) => {
  const x = new Date(d);
  const p = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`;
};

export const STATUS_LABEL = {
  SUBMITTED: 'Submitted', ASSIGNED: 'Assigned', ACCEPTED: 'Accepted', ON_THE_WAY: 'On the way',
  ARRIVED: 'Arrived', SERVICE_STARTED: 'Service started', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
};
export const STATUS_STYLE = {
  SUBMITTED: 'bg-slate-100 text-slate-700', ASSIGNED: 'bg-blue-100 text-blue-700', ACCEPTED: 'bg-indigo-100 text-indigo-700',
  ON_THE_WAY: 'bg-amber-100 text-amber-800', ARRIVED: 'bg-orange-100 text-orange-800', SERVICE_STARTED: 'bg-purple-100 text-purple-700',
  COMPLETED: 'bg-green-100 text-green-700', CANCELLED: 'bg-red-100 text-red-700',
};
export const URGENCY_STYLE = { LOW: 'bg-slate-100 text-slate-700', MEDIUM: 'bg-amber-100 text-amber-800', HIGH: 'bg-red-100 text-red-700' };
export const AVAIL_STYLE = { AVAILABLE: 'bg-green-100 text-green-700', BUSY: 'bg-amber-100 text-amber-800', OFFLINE: 'bg-slate-200 text-slate-700', ON_LEAVE: 'bg-purple-100 text-purple-700' };
export const VERIFY_STYLE = { PENDING: 'bg-amber-100 text-amber-800', APPROVED: 'bg-green-100 text-green-700', REJECTED: 'bg-red-100 text-red-700' };
export const PAY_STYLE = { PENDING: 'bg-amber-100 text-amber-800', PAID: 'bg-green-100 text-green-700', FAILED: 'bg-red-100 text-red-700', REFUNDED: 'bg-slate-200 text-slate-700', UNPAID: 'bg-slate-100 text-slate-600' };

export const CATEGORY_LABEL = { APPLIANCE: 'Appliance Services', ELECTRICAL: 'Electrical Services', PLUMBING: 'Plumbing Services', CLEANING: 'Cleaning Services' };
export const CATEGORY_GRADIENT = {
  APPLIANCE: 'from-sky-500 to-cyan-400',
  ELECTRICAL: 'from-amber-500 to-yellow-400',
  PLUMBING: 'from-blue-600 to-indigo-400',
  CLEANING: 'from-emerald-500 to-teal-300',
};

export const directionsUrl = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

export const downloadBlob = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
