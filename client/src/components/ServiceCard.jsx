import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORY_GRADIENT, inr } from '../utils/format';
import { Stars } from './ui';

/** The service photo when there is one and it loads; otherwise the category icon panel. */
function ServiceVisual({ service }) {
  const [broken, setBroken] = useState(false);
  if (service.imageUrl && !broken) {
    return (
      <img
        src={service.imageUrl}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
        className="block aspect-[16/10] w-full bg-slate-100 object-cover object-center transition duration-300 group-hover:scale-105"
      />
    );
  }
  return (
    <div className={`flex aspect-[16/10] w-full items-center justify-center bg-gradient-to-br ${CATEGORY_GRADIENT[service.category] || 'from-brand-500 to-brand-300'}`}>
      <span className="text-6xl drop-shadow transition group-hover:scale-110" aria-hidden="true">{service.icon || '🔧'}</span>
    </div>
  );
}

/** Section 10 card: image, name, rating, "Starting from ₹X", Book Service. Prices are configurable demo values. */
export default function ServiceCard({ service, to }) {
  const target = to || `/customer/request?service=${service._id}`;
  return (
    <div className="card group flex h-full flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <Link to={`/services/${service._id}`} className="block overflow-hidden" aria-label={`${service.name} details`}>
        <ServiceVisual service={service} />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <Link to={`/services/${service._id}`} className="text-base font-semibold hover:text-brand-700">{service.name}</Link>
        <Stars value={service.ratingAvg || 4.5} count={service.ratingCount || undefined} size="text-sm" />
        <p className="text-sm text-ink-500">Starting from <span className="text-lg font-bold text-ink-900">{inr(service.startingPrice)}</span></p>
        <div className="mt-auto pt-2">
          <Link to={target} className="btn-primary w-full">Book Service</Link>
        </div>
      </div>
    </div>
  );
}
