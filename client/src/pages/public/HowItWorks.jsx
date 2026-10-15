import { Link } from 'react-router-dom';

const STEPS = [
  { icon: '🛎️', title: '1. Choose Service', text: 'Browse services, pick a package if there is one, describe the problem, share your location on the map and choose a date, time and urgency.' },
  { icon: '🧠', title: '2. Smart Technician Matching', text: 'Only verified technicians with the right skill, who are free at your time and within range, are considered. Then a weighted score ranks distance, workload, rating and experience. The best one is offered the job; if they decline or do not answer, the next best is chosen automatically.' },
  { icon: '📡', title: '3. Track Your Service', text: 'Follow the status live: assigned → accepted → on the way → arrived → service started → completed. You can cancel or reschedule until the service starts.' },
  { icon: '⭐', title: '4. Pay & Rate', text: 'Pay online (Razorpay, verified on our server) or in cash. Your technician earns after the platform fee; then you rate the service.' },
];

export default function HowItWorks() {
  return (
    <div className="container-app py-10">
      <h1 className="page-title">How FixFlow works</h1>
      <p className="mt-2 max-w-2xl text-ink-500">From booking to payment in four simple steps.</p>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {STEPS.map((s) => (
          <div key={s.title} className="card flex gap-4 p-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-3xl" aria-hidden="true">{s.icon}</div>
            <div><h2 className="text-lg font-bold">{s.title}</h2><p className="mt-1 text-sm text-ink-700">{s.text}</p></div>
          </div>
        ))}
      </div>

      <h2 className="section-title mt-14">Emergency priority</h2>
      <div className="card-pad mt-4 text-sm text-ink-700">
        Requests carry a priority — <strong>Low (20)</strong>, <strong>Medium (50)</strong>, <strong>High (100)</strong>. High-priority requests are processed first and technicians get a shorter time to respond, so urgent problems are matched faster. Which technician is chosen still depends on skill, availability and score — never on priority alone.
      </div>

      <h2 className="section-title mt-10">Service only — no products</h2>
      <div className="card-pad mt-4 text-sm text-ink-700">
        You own the product (the fan, the AC, the tap). We send a verified technician to install, repair or clean it. If a replacement part is needed, you arrange it; FixFlow does not sell products or spare parts.
      </div>

      <div className="mt-10 flex flex-wrap gap-3"><Link to="/services" className="btn-primary btn-lg">Explore services</Link><Link to="/technician/register" className="btn-outline btn-lg">Become a technician</Link></div>
    </div>
  );
}
