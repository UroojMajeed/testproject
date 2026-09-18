import { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Chip, QuadrantChip } from '../../../components/ui/Chip.jsx';
import { formatHours, formatMoney } from '../../../lib/formatters.js';
import { ACTION_LABEL } from '../../../lib/constants.js';

const CONFIDENCE_TONE = { high: 'verified', medium: 'neutral', low: 'warn' };

const SIGNAL_LABEL = {
  sampleSize: 'Sample size',
  frequency: 'Frequency',
  energyConsistency: 'Energy consistency',
  durationVariance: 'Duration variance',
  volume: 'Weekly volume',
};

/**
 * Every recommendation ships with its evidence and its confidence signals.
 * Nothing on this card is asserted without the numbers it came from — that is
 * the whole reason the user can be expected to act on it.
 */
export function RecommendationCard({ rec, rank, currency, canManage, busy, onAccept, onReject, onSnooze }) {
  const [showWhy, setShowWhy] = useState(rank === 1);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const task = typeof rec.taskId === 'object' ? rec.taskId : null;

  return (
    <article className="surface p-3 p-sm-4">
      <div className="d-flex flex-wrap align-items-start gap-2 mb-2">
        <Chip tone="neutral">{ACTION_LABEL[rec.type] ?? rec.type}</Chip>
        {task?.drip?.quadrant && <QuadrantChip quadrant={task.drip.quadrant} />}
        <Chip tone={CONFIDENCE_TONE[rec.confidence?.level] ?? 'neutral'}>
          {rec.confidence?.level} confidence
        </Chip>
        <span className="numeral fs-caption text-muted-3 ms-auto">#{rank}</span>
      </div>

      <h3 className="display-serif mb-3" style={{ fontSize: '1.5rem' }}>{rec.title}</h3>

      <dl className="row g-3 py-3 mb-3 border-top border-bottom">
        <div className="col-6 col-lg-3">
          <dt className="fs-caption text-muted-3 fw-normal">Costs you weekly</dt>
          <dd className="numeral fs-lead mb-0">
            {formatHours((task?.actualMinutes ?? 0) / 60 / 2)}
          </dd>
        </div>
        <div className="col-6 col-lg-3">
          <dt className="fs-caption text-muted-3 fw-normal">Projected back</dt>
          <dd className="numeral fs-lead mb-0 text-estimated">~{formatHours(rec.estimatedHoursSavedPerWeek)}</dd>
        </div>
        <div className="col-6 col-lg-3">
          <dt className="fs-caption text-muted-3 fw-normal">To set up</dt>
          <dd className="numeral fs-lead mb-0">{Math.round(rec.implementationEffortMinutes / 60 * 10) / 10}h</dd>
        </div>
        <div className="col-6 col-lg-3">
          <dt className="fs-caption text-muted-3 fw-normal">Annual opportunity</dt>
          <dd className="numeral fs-lead mb-0 text-warn">
            {formatMoney((rec.estimatedValueSavedMinor ?? 0) * 52, currency, { compact: true })}
          </dd>
        </div>
      </dl>

      <div className="rounded p-3 mb-3" style={{ background: 'var(--ground)', border: '1px solid var(--line)' }}>
        <button
          type="button"
          className="btn btn-quiet p-0 d-flex align-items-center gap-2 mb-2"
          style={{ minHeight: 'auto' }}
          onClick={() => setShowWhy((v) => !v)}
          aria-expanded={showWhy}
        >
          <span className="fs-ui fw-semibold">Why you are seeing this</span>
          <span aria-hidden="true">{showWhy ? '−' : '+'}</span>
        </button>

        <p className="fs-ui text-muted-2 mb-3">{rec.reason}</p>

        {showWhy && (
          <>
            <ul className="list-unstyled d-flex flex-wrap gap-2 mb-3">
              {(rec.evidence ?? []).map((e, i) => (
                <li key={i}>
                  <span className="chip chip-neutral" style={{ background: 'var(--surface)' }}>
                    {e.label}: {String(e.value)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="pt-3 border-top">
              <div className="d-flex align-items-center gap-2 mb-2">
                <span className="fs-ui-sm fw-semibold">Confidence is computed from these signals</span>
                <span className="numeral fs-caption text-muted-2 ms-auto">
                  {rec.confidence?.score?.toFixed(2)}
                </span>
              </div>
              <ul className="list-unstyled stack gap-2 mb-0">
                {(rec.confidence?.signals ?? []).map((s) => (
                  <li key={s.name} className="d-flex align-items-center gap-3">
                    <span className="fs-caption text-muted-2" style={{ width: 140 }}>
                      {SIGNAL_LABEL[s.name] ?? s.name}
                    </span>
                    <div className="flex-grow-1 rounded-pill overflow-hidden" style={{ height: 5, background: 'var(--sunken)' }}>
                      <div style={{ width: `${Math.round(s.value * 100)}%`, height: '100%', background: 'var(--verified)' }} />
                    </div>
                    <span className="numeral fs-caption text-muted-3" style={{ width: 92, textAlign: 'right' }}>
                      {s.detail}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="fs-caption text-muted-3 mb-0 mt-2">
                Computed from your entries, not asserted — the same inputs always give the same score.
              </p>
            </div>
          </>
        )}
      </div>

      {canManage && (
        rejecting ? (
          <div className="stack gap-2">
            <label className="form-label" htmlFor={`why-${rec.id}`}>Why are you rejecting this?</label>
            <input
              id={`why-${rec.id}`} className="form-control" value={reason} maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional — it improves what we suggest next"
            />
            <div className="d-flex gap-2">
              <Button variant="outline" onClick={() => { onReject(reason); setRejecting(false); }} disabled={busy}>
                Confirm rejection
              </Button>
              <Button variant="quiet" onClick={() => setRejecting(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="d-flex flex-wrap gap-2 align-items-center">
            <Button onClick={onAccept} loading={busy} loadingLabel="Creating plan">
              Create a buyback plan
            </Button>
            <Button variant="outline" onClick={onSnooze} disabled={busy}>Ask me in 4 weeks</Button>
            <Button variant="quiet" className="ms-auto" onClick={() => setRejecting(true)} disabled={busy}>
              Reject
            </Button>
          </div>
        )
      )}
    </article>
  );
}
