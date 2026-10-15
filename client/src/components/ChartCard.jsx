import { useState } from 'react';

// Categorical slots 1-3 of the validated reference palette (light surface). Identity is never colour-alone:
// every multi-series chart also has a legend, tooltips and a table view.
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a'];
export const INK = { primary: '#0f172a', secondary: '#475569', grid: '#e2e8f0' };

export const axisProps = { tick: { fill: INK.secondary, fontSize: 12 }, axisLine: { stroke: INK.grid }, tickLine: false };
export const gridProps = { stroke: INK.grid, strokeDasharray: '3 3', vertical: false };

/** Card with a title, the chart, and an accessible "table view" of the exact same numbers. */
export default function ChartCard({ title, subtitle, columns, rows, children, empty }) {
  const [table, setTable] = useState(false);
  const hasData = rows && rows.length > 0;
  return (
    <section className="card p-4 sm:p-5" aria-label={title}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div><h3 className="font-bold">{title}</h3>{subtitle && <p className="text-xs text-ink-500">{subtitle}</p>}</div>
        {hasData && <button className="btn-ghost btn-sm" onClick={() => setTable((t) => !t)} aria-pressed={table}>{table ? '📈 Chart' : '▦ Table'}</button>}
      </div>
      {!hasData ? <p className="py-10 text-center text-sm text-ink-500">{empty || 'No data yet'}</p> : table ? (
        <div className="max-h-64 overflow-auto"><table className="table min-w-0"><thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{columns.map((c) => <td key={c.key}>{c.format ? c.format(r[c.key]) : r[c.key]}</td>)}</tr>)}</tbody></table></div>
      ) : <div className="h-64 w-full">{children}</div>}
    </section>
  );
}
