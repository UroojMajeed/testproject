import { useState } from 'react';
import { formatDuration, formatMoney } from '../../../lib/formatters.js';
import { quadrantStyle } from '../../../components/ui/Chip.jsx';

const CORNERS = [
  { key: 'investment', style: { left: 12, top: 10 }, align: 'start' },
  { key: 'production', style: { right: 12, top: 10 }, align: 'end' },
  { key: 'delegation', style: { left: 12, bottom: 10 }, align: 'start' },
  { key: 'replacement', style: { right: 12, bottom: 10 }, align: 'end' },
];

/**
 * Four-quadrant scatter. Energy on Y, money on X.
 *
 * Identity is carried by position and label as well as colour — the quadrant
 * headings are always visible, and the table view below repeats every figure.
 */
export function DripMatrix({ points = [], quadrants = {}, currency = 'USD', onSelect, selectedId, compact = false }) {
  const [hover, setHover] = useState(null);
  const height = compact ? 300 : 460;
  const maxMinutes = Math.max(30, ...points.map((p) => p.minutesPerWeek));

  return (
    <div className="d-flex gap-2">
      <div
        className="d-none d-sm-flex align-items-center justify-content-center fs-caption text-muted-3"
        style={{ width: 18, writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        aria-hidden="true"
      >
        Drains energy ←→ Gives energy
      </div>

      <div className="flex-grow-1">
        <div
          className="position-relative rounded border"
          style={{ height, background: 'var(--ground)', borderColor: 'var(--line)' }}
        >
          <div className="position-absolute top-0 bottom-0" style={{ left: '50%', width: 1, background: 'var(--line-strong)' }} />
          <div className="position-absolute start-0 end-0" style={{ top: '50%', height: 1, background: 'var(--line-strong)' }} />

          {CORNERS.map(({ key, style, align }) => {
            const q = quadrantStyle(key);
            const data = quadrants[key] ?? {};
            return (
              <div key={key} className="position-absolute stack gap-0" style={{ ...style, alignItems: align === 'end' ? 'flex-end' : 'flex-start' }}>
                <span className="fs-caption fw-semibold" style={{ color: q.text, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  {q.label}
                </span>
                <span className="numeral fs-caption text-muted-2">
                  {formatDuration(data.minutes ?? 0)} · {formatMoney(data.costMinor ?? 0, currency)}
                </span>
              </div>
            );
          })}

          {points.map((p) => {
            const q = quadrantStyle(p.quadrant);
            const size = 10 + Math.round((p.minutesPerWeek / maxMinutes) * 14);
            const active = hover === p.taskId || selectedId === p.taskId;
            return (
              <button
                key={p.taskId}
                type="button"
                className="position-absolute btn p-0 border-0 bg-transparent"
                style={{
                  left: `${8 + p.x * 84}%`,
                  top: `${88 - p.y * 76}%`,
                  transform: 'translate(-50%, -50%)',
                  minHeight: 'auto',
                }}
                onMouseEnter={() => setHover(p.taskId)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(p.taskId)}
                onBlur={() => setHover(null)}
                onClick={() => onSelect?.(p)}
                aria-label={`${p.title}: ${formatDuration(p.minutesPerWeek)} a week, ${q?.label ?? 'unclassified'}`}
              >
                <span
                  className="d-inline-flex align-items-center gap-2 px-2 py-1 rounded"
                  style={{
                    background: active ? 'var(--surface)' : 'transparent',
                    border: active ? `1px solid ${q?.border ?? 'var(--line)'}` : '1px solid transparent',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span
                    className="drip-dot"
                    style={{ width: size, height: size, background: q?.color ?? 'var(--line-strong)' }}
                    aria-hidden="true"
                  />
                  {(active || !compact) && (
                    <span className="fs-caption" style={{ color: 'var(--ink)' }}>
                      {p.title}
                      {active && <span className="numeral text-muted-3"> · {formatDuration(p.minutesPerWeek)}</span>}
                    </span>
                  )}
                </span>
              </button>
            );
          })}

          {!points.length && (
            <p className="position-absolute top-50 start-50 translate-middle fs-ui text-muted-3 mb-0">
              Nothing classified yet
            </p>
          )}
        </div>

        <div className="d-flex justify-content-between px-1 pt-1">
          <span className="fs-caption text-muted-3">Less money</span>
          <span className="fs-caption text-muted-3">More money</span>
        </div>
      </div>
    </div>
  );
}
