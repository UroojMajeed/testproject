import { forwardRef, useId, useState } from 'react';

/** Rough, local-only strength read-out. The server holds the real policy. */
function scorePassword(value = '') {
  if (!value) return null;
  let score = 0;
  if (value.length >= 12) score += 1;
  if (value.length >= 16) score += 1;
  if (/\s/.test(value) && value.trim().split(/\s+/).length >= 3) score += 1;
  if (/[^A-Za-z0-9]/.test(value) || /\d/.test(value)) score += 1;
  return Math.min(score, 4);
}

const LABELS = ['Too short', 'Weak', 'Reasonable', 'Strong', 'Very strong'];
const WIDTHS = ['20%', '40%', '60%', '80%', '100%'];
// Only colours that clear 3:1 against the track.
const COLOURS = ['var(--warn)', 'var(--warn)', 'var(--estimated)', 'var(--verified)', 'var(--verified)'];

export const PasswordField = forwardRef(function PasswordField(
  { label = 'Password', error, hint, value, showStrength = false, required, className = '', ...rest },
  ref,
) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const strengthId = `${id}-strength`;

  const score = showStrength ? scorePassword(value) : null;
  const describedBy =
    [hint ? hintId : null, score !== null ? strengthId : null, error ? errorId : null]
      .filter(Boolean).join(' ') || undefined;

  return (
    <div className={`stack ${className}`}>
      <label className="form-label" htmlFor={id}>
        {label}
        {required && (
          <>
            <span aria-hidden="true"> *</span>
            <span className="visually-hidden"> (required)</span>
          </>
        )}
      </label>

      <div className="position-relative">
        <input
          ref={ref}
          id={id}
          type={visible ? 'text' : 'password'}
          className="form-control pe-5"
          value={value}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          {...rest}
        />
        <button
          type="button"
          className="btn btn-quiet position-absolute top-50 end-0 translate-middle-y me-1 px-2"
          style={{ minHeight: '2rem' }}
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          <span aria-hidden="true" className="fs-caption fw-semibold">{visible ? 'HIDE' : 'SHOW'}</span>
        </button>
      </div>

      {score !== null && (
        <div id={strengthId} className="mt-2">
          <div
            className="rounded-pill overflow-hidden"
            style={{ height: 4, background: 'var(--sunken)' }}
            aria-hidden="true"
          >
            <div style={{ width: WIDTHS[score], height: '100%', background: COLOURS[score] }} />
          </div>
          {/* The text, not the bar, is what gets announced. */}
          <p className="field-hint mb-0" aria-live="polite">Password strength: {LABELS[score]}</p>
        </div>
      )}

      {hint && !error && <p id={hintId} className="field-hint mb-0">{hint}</p>}
      {error && (
        <p id={errorId} className="field-error mb-0">
          <span aria-hidden="true">⚠</span>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
});
