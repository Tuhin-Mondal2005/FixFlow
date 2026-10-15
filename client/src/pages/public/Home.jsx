import { Link } from 'react-router-dom';
import { Carousel, HeroCarousel } from '../../components/Carousel';
import ServiceCard from '../../components/ServiceCard';
import { Skeleton, Stars } from '../../components/ui';
import { useFetch } from '../../hooks/useAsync';

const POPULAR_SLUGS = ['ac-repair', 'ac-cleaning', 'fan-installation', 'tap-repair', 'bathroom-cleaning', 'washing-machine-repair', 'refrigerator-repair', 'water-purifier-service'];

function Slide({ image, eyebrow, title, text, cta, to }) {
  return (
    <div className="relative overflow-hidden bg-ink-900 text-white">
      <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover object-center" loading="eager" decoding="async" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/55 to-black/25" aria-hidden="true" />
      <div className="container-app relative flex min-h-[26rem] items-center py-14 pb-20 sm:min-h-[30rem] sm:py-20 sm:pb-24 md:min-h-[34rem]">
        <div className="max-w-2xl">
          <span className="mb-4 inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur">{eyebrow}</span>
          <h1 className="text-3xl font-extrabold leading-tight drop-shadow sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-xl text-base text-white/90 drop-shadow sm:text-lg">{text}</p>
          <Link to={to} className="btn-lg mt-8 inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 font-bold text-ink-900 shadow-lg transition hover:bg-slate-100">{cta} →</Link>
        </div>
      </div>
    </div>
  );
}

const SLIDES = [
  <Slide key="1" image="/images/hero/bg1.jpg" eyebrow="Verified professionals" title="Trusted Technicians. Right at Your Doorstep." text="Book verified local professionals for your home service needs." cta="Book a Service" to="/customer/request" />,
  <Slide key="2" image="/images/hero/bg2.jpg" eyebrow="Emergency priority" title="Need Urgent Help?" text="Our smart assignment system finds the most suitable available technician." cta="Emergency Service" to="/customer/request?urgency=HIGH" />,
  <Slide key="3" image="/images/hero/bg3.jpg" eyebrow="Transparent pricing" title="Verified Professionals. Transparent Pricing." text="Choose the service you need and track your request from booking to completion." cta="Explore Services" to="/services" />,
  <Slide key="4" image="/images/hero/bg4.jpg" eyebrow="For technicians" title="More Opportunities for Local Technicians" text="Join FixFlow and connect with customers near you." cta="Become a Technician" to="/technician/register" />,
];

const STEPS = [
  { icon: '🛎️', title: 'Choose Service', text: 'Pick a service, describe the problem and share your location.' },
  { icon: '🧠', title: 'Smart Technician Matching', text: 'We match skill, availability, distance, workload and rating.' },
  { icon: '📡', title: 'Track Your Service', text: 'Follow your technician in real time from booking to completion.' },
  { icon: '⭐', title: 'Pay & Rate', text: 'Pay online or cash, then rate your technician.' },
];

const WHY = [
  { icon: '🛡️', title: 'Verified Technicians', text: 'Technicians are reviewed by admin before receiving jobs.' },
  { icon: '🧠', title: 'Smart Assignment', text: 'The system considers skills, availability, location, workload and rating.' },
  { icon: '📡', title: 'Real-Time Tracking', text: 'Track service progress.' },
  { icon: '🏷️', title: 'Transparent Pricing', text: 'Show service starting prices and final bill.' },
  { icon: '🚨', title: 'Emergency Priority', text: 'High-priority requests receive faster assignment.' },
  { icon: '⚖️', title: 'Workload Balanced', text: 'Jobs are distributed intelligently among suitable technicians.' },
];

export default function Home() {
  const { data, loading } = useFetch('/services');
  const reviewsRes = useFetch('/services/public/reviews');
  const services = data ? data.services : [];
  const popular = POPULAR_SLUGS.map((s) => services.find((x) => x.slug === s)).filter(Boolean);
  const reviews = reviewsRes.data ? reviewsRes.data.reviews : []; // real customer reviews only

  return (
    <>
      <HeroCarousel slides={SLIDES} />

      <section className="container-app py-14">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div><h2 className="section-title">Popular services</h2></div>
          <Link to="/services" className="btn-outline btn-sm whitespace-nowrap">View all</Link>
        </div>
        {loading ? <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64" />)}</div> : (
          <Carousel label="Popular services">{popular.map((s) => <ServiceCard key={s._id} service={s} />)}</Carousel>
        )}
      </section>

      <section className="py-14" id="how">
        <div className="container-app">
          <h2 className="section-title text-center">How it works</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.title} className="relative rounded-2xl border border-slate-200 bg-white p-6 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-3xl" aria-hidden="true">{s.icon}</div>
                <div className="text-xs font-bold uppercase tracking-wider text-brand-600">Step {i + 1}</div>
                <h3 className="mt-1 text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-sm text-ink-500">{s.text}</p>
                {i < STEPS.length - 1 && <span className="absolute -right-4 top-1/2 hidden -translate-y-1/2 text-2xl text-slate-300 lg:block" aria-hidden="true">→</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-app py-14">
        <h2 className="section-title text-center">Why choose FixFlow</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {WHY.map((w) => (
            <div key={w.title} className="card flex gap-4 p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-2xl" aria-hidden="true">{w.icon}</div>
              <div><h3 className="font-bold">{w.title}</h3><p className="mt-1 text-sm text-ink-500">{w.text}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="container-app">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-ink-900 to-brand-800 px-6 py-12 text-center text-white sm:px-12">
          <h2 className="text-2xl font-extrabold sm:text-4xl">Are you a skilled technician?</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/80">Join FixFlow and get service opportunities near your location.</p>
          <Link to="/technician/register" className="btn-accent btn-lg mt-6">Become a Technician</Link>
        </div>
      </section>

      <section className="container-app py-14">
        <h2 className="section-title text-center">What customers say</h2>
        <div className="mt-8">
          {reviewsRes.loading && !reviewsRes.data ? <Skeleton className="h-40" /> : reviews.length > 0 ? (
            <Carousel label="Customer reviews" itemClass="w-[88%] sm:w-[48%] lg:w-[32%]">
              {reviews.map((r, i) => (
                <figure key={i} className="card h-full p-6">
                  <Stars value={r.rating} showNumber={false} size="text-xl" />
                  <blockquote className="mt-3 text-base text-ink-900">“{r.comment}”</blockquote>
                  <figcaption className="mt-4 text-sm text-ink-500">— {r.customer}{r.service ? `, ${r.service}` : ''}</figcaption>
                </figure>
              ))}
            </Carousel>
          ) : (
            <p className="text-center text-ink-500">{reviewsRes.error ? 'Reviews are unavailable right now.' : 'No reviews yet. Reviews from customers appear here after they rate a completed service.'}</p>
          )}
        </div>
      </section>
    </>
  );
}
