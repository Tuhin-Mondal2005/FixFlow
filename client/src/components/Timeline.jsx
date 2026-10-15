import { dateTime } from '../utils/format';

/** Section 14: ✓ done, → current, ○ upcoming. Works vertically (mobile friendly). */
export default function Timeline({ steps }) {
  if (!steps || !steps.length) return null;
  return (
    <ol className="relative space-y-4" aria-label="Request progress">
      {steps.map((s, i) => {
        const cancelled = s.key === 'CANCELLED';
        const icon = cancelled ? '✕' : s.done && !s.current ? '✓' : s.current ? '→' : '○';
        const tone = cancelled ? 'bg-red-600 text-white' : s.current ? 'bg-brand-600 text-white ring-4 ring-brand-100' : s.done ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500';
        return (
          <li key={s.key} className="flex gap-3" aria-current={s.current ? 'step' : undefined}>
            <div className="flex flex-col items-center">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${tone}`}>{icon}</span>
              {i < steps.length - 1 && <span className={`mt-1 w-0.5 flex-1 ${s.done && !s.current ? 'bg-green-300' : 'bg-slate-200'}`} />}
            </div>
            <div className="pb-1">
              <div className={`text-sm font-semibold ${s.done || s.current ? 'text-ink-900' : 'text-ink-500'}`}>{s.label}</div>
              {s.at && (s.done || s.current) && <div className="text-xs text-ink-500">{dateTime(s.at)}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
