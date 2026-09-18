import { useId, useState } from 'react';
import { formatDuration } from '../../lib/formatters.js';

const SERIES = [
  { key: 'production', label: 'Production', color: 'var(--drip-production)' },
  { key: 'investment', label: 'Investment', color: 'var(--drip-investment)' },
  { key: 'replacement', label: 'Replacement', color: 'var(--drip-replacement)' },
  { key: 'delegation', label: 'Delegation', color: 'var(--drip-delegation)' },
  { key: 'unclassified', label: 'Unclassified', color: 'var(--line-strong)' },
];

/**
 * Stacked columns by DRIP quadrant. A legend is always present for multiple
 * series, and the table below carries the same figures for anyone who cannot
 * read the colours — identity is never colour alone.
 */
export function StackedWeekChart({ days = [], height = 220 }) {
  const id = useId();
  const [hover, setHover] = useState(null);
  const [showTable, setShowTable] = useState(false);

  const totals = days.map((d) => Object.values(d.byQuadrant ?? {}).reduce((s, v) => s + v, 0));
  const peak = Math.max(60, ...totals);

  if (!days.length) return null;

  return (
    <figure className="mb-0">
      <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
        <ul className="list-unstyled d-flex flex-wrap gap-3 mb-0">
          {SERIES.filter((s) => days.some((d) => (d.byQuadrant?.[s.key] ?? 0) > 0)).map((s) => (
            <li key={s.key} className="d-flex align-items-center gap-2 fs-caption text-muted-2">
              <span className="drip-dot" style={{ background: s.color }} aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="btn btn-quiet fs-caption ms-auto px-2"
          style={{ minHeight: '2rem' }}
          onClick={() => setShowTable((v) => !v)}
          aria-expanded={showTable}
          aria-controls={`${id}-table`}
        >
          {showTable ? 'Hide figures' : 'Show figures'}
        </button>
      </div>

      <div className="d-flex align-items-end gap-2" style={{ height }} role="presentation">
        {days.map((d, i) => {
          const total = totals[i];
          const label = new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(d.date));
          return (
            <div
              key={d.date}
              className="d-flex flex-column align-items-center gap-1 flex-grow-1"
              style={{ height: '100%', minWidth: 0 }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <span className="numeral fs-caption text-muted-3" style={{ minHeight: '1rem' }}>
                {hover === i && total ? formatDuration(total) : ''}
              </span>
              <div
                className="d-flex flex-column-reverse w-100 rounded-top"
                style={{ height: '100%', justifyContent: 'flex-start', gap: 2 }}
              >
                {SERIES.map((s) => {
                  const mins = d.byQuadrant?.[s.key] ?? 0;
                  if (!mins) return null;
                  return (
                    <div
                      key={s.key}
                      style={{
                        height: `${(mins / peak) * 100}%`,
                        background: s.color,
                        borderRadius: 2,
                        opacity: hover === null || hover === i ? 1 : 0.45,
                      }}
                    />
                  );
                })}
              </div>
              <span className="fs-caption text-muted-3">{label}</span>
            </div>
          );
        })}
      </div>

      {showTable && (
        <div className="table-responsive mt-3" id={`${id}-table`}>
          <table className="table table-sm fs-ui mb-0">
            <caption className="fs-caption text-muted-3">Minutes tracked per day, by quadrant</caption>
            <thead>
              <tr>
                <th scope="col">Day</th>
                {SERIES.map((s) => <th scope="col" key={s.key} className="text-end">{s.label}</th>)}
                <th scope="col" className="text-end">Total</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d, i) => (
                <tr key={d.date}>
                  <th scope="row" className="fw-normal">
                    {new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(d.date))}
                  </th>
                  {SERIES.map((s) => (
                    <td key={s.key} className="text-end numeral">{d.byQuadrant?.[s.key] ?? 0}</td>
                  ))}
                  <td className="text-end numeral fw-semibold">{totals[i]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}
