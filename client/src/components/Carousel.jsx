import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Horizontal card carousel (scroll-snap). Used only where it helps: popular services, reviews,
 * recommended services, new job requests. Works with touch, trackpad, keyboard (buttons) and mouse.
 */
export function Carousel({ children, itemClass = 'w-[78%] sm:w-[46%] lg:w-[30%] xl:w-[23%]', label = 'Carousel' }) {
  const ref = useRef(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return undefined;
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { el.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [update, children]);

  const scrollBy = (dir) => { const el = ref.current; if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' }); };
  const items = Array.isArray(children) ? children : [children];

  return (
    <div className="relative" role="region" aria-roledescription="carousel" aria-label={label}>
      <div ref={ref} className="snap-row" tabIndex={0}>
        {items.filter(Boolean).map((c, i) => <div key={i} className={itemClass}>{c}</div>)}
      </div>
      {!edge.start && <button aria-label="Previous" onClick={() => scrollBy(-1)} className="absolute -left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-slate-200 hover:bg-slate-50 md:flex">‹</button>}
      {!edge.end && <button aria-label="Next" onClick={() => scrollBy(1)} className="absolute -right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-slate-200 hover:bg-slate-50 md:flex">›</button>}
    </div>
  );
}

/** Full-width auto-playing hero carousel with dots, arrows, swipe and pause-on-hover. */
export function HeroCarousel({ slides, interval = 6000 }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touch = useRef(null);
  const n = slides.length;
  const go = useCallback((k) => setI((k + n) % n), [n]);

  useEffect(() => {
    if (paused || n < 2) return undefined;
    const t = setInterval(() => setI((x) => (x + 1) % n), interval);
    return () => clearInterval(t);
  }, [paused, n, interval]);

  return (
    <div className="relative overflow-hidden" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { if (touch.current === null) return; const d = e.changedTouches[0].clientX - touch.current; if (Math.abs(d) > 50) go(i + (d < 0 ? 1 : -1)); touch.current = null; }}
      role="region" aria-roledescription="carousel" aria-label="Featured">
      <div className="flex transition-transform duration-700 ease-out" style={{ transform: `translateX(-${i * 100}%)` }}>
        {slides.map((s, k) => (
          <div key={k} className="w-full shrink-0" aria-hidden={k !== i} role="group" aria-label={`Slide ${k + 1} of ${n}`}>{s}</div>
        ))}
      </div>
      <button aria-label="Previous slide" onClick={() => go(i - 1)} className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-2xl text-white backdrop-blur hover:bg-white/35 md:flex">‹</button>
      <button aria-label="Next slide" onClick={() => go(i + 1)} className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-2xl text-white backdrop-blur hover:bg-white/35 md:flex">›</button>
      <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2">
        {slides.map((_, k) => (
          <button key={k} aria-label={`Go to slide ${k + 1}`} onClick={() => go(k)} className={`h-2.5 rounded-full transition-all ${k === i ? 'w-8 bg-white' : 'w-2.5 bg-white/50 hover:bg-white/80'}`} />
        ))}
      </div>
    </div>
  );
}
