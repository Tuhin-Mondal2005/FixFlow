import { Link } from 'react-router-dom';

const BENEFITS = [
  { icon: '📍', title: 'Jobs near you', text: 'The matching engine prefers technicians close to the customer, so less travel and more work.' },
  { icon: '⚖️', title: 'Fair distribution', text: 'Workload balancing makes sure jobs are not all given to the same few people.' },
  { icon: '💰', title: 'Transparent earnings', text: 'See every job, the platform fee and your earning in a clear ledger.' },
  { icon: '🕒', title: 'You control your time', text: 'Set availability, working hours, and tell us when you will be free again.' },
];
const STEPS = ['Register with your skills and experience', 'Upload your Aadhaar and qualification documents', 'Wait while an admin verifies you (status: Pending)', 'Once approved, log in and start receiving jobs'];

export default function BecomeTechnician() {
  return (
    <div className="container-app py-10">
      <div className="rounded-3xl bg-gradient-to-br from-brand-700 to-brand-500 px-6 py-12 text-white sm:px-12">
        <h1 className="text-3xl font-extrabold sm:text-5xl">Are you a skilled technician?</h1>
        <p className="mt-3 max-w-xl text-lg text-white/90">Join FixFlow and get service opportunities near your location.</p>
        <Link to="/technician/register" className="btn-accent btn-lg mt-6">Apply now</Link>
        <Link to="/technician/login" className="ml-3 text-sm font-semibold underline">Already approved? Log in</Link>
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {BENEFITS.map((b) => <div key={b.title} className="card flex gap-4 p-5"><div className="text-3xl" aria-hidden="true">{b.icon}</div><div><h3 className="font-bold">{b.title}</h3><p className="mt-1 text-sm text-ink-500">{b.text}</p></div></div>)}
      </div>

      <h2 className="section-title mt-12">How onboarding works</h2>
      <ol className="mt-4 space-y-3">{STEPS.map((s, i) => <li key={s} className="card flex items-center gap-4 p-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 font-bold text-white">{i + 1}</span>{s}</li>)}</ol>

      <div className="mt-8 rounded-2xl bg-slate-100 p-5 text-sm text-ink-700">
        <strong>Your documents are private.</strong> Aadhaar and certificates are encrypted, never shown publicly, and only an administrator can open them for verification. Your full Aadhaar number is stored encrypted and shown masked. Only administrators can reveal it, and every reveal is logged.
      </div>
    </div>
  );
}
