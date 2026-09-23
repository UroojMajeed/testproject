import { forwardRef, useId, useState } from 'react';

/**
 * A password field with a reveal toggle.
 *
 * Letting people see what they typed reduces failed sign-ins more than any
 * validation message does — a mistyped long passphrase is the common case, and a
 * 12-character minimum makes it commoner. The toggle is a real button, so it is
 * reachable by keyboard, and `aria-pressed` tells a screen reader which state it
 * is in rather than leaving the label to guess.
 *
 * The input is never inside the toggle's tab order trap: the field, then the
 * toggle, then the next field. That is the order the markup already gives.
 */
export const PasswordField = forwardRef(function PasswordField(
  { label, hint, error, autoComplete = 'current-password', required, className = '', ...rest },
  ref,
) {
  const [revealed, setRevealed] = useState(false);
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`mb-4 ${className}`.trim()}>
      <label className="form-label" htmlFor={id}>
        {label}
        {required ? (
          <>
            <span aria-hidden="true"> *</span>
            <span className="visually-hidden"> (required)</span>
          </>
        ) : null}
      </label>

      <div className="input-group">
        <input
          {...rest}
          ref={ref}
          id={id}
          type={revealed ? 'text' : 'password'}
          className="form-control"
          autoComplete={autoComplete}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          aria-required={required ? 'true' : undefined}
        />
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => setRevealed((v) => !v)}
          aria-pressed={revealed}
          aria-label={revealed ? 'Hide password' : 'Show password'}
        >
          {revealed ? 'Hide' : 'Show'}
        </button>
      </div>

      {hint ? <span className="field-hint" id={hintId}>{hint}</span> : null}
      {error ? <span className="field-error" id={errorId}>{error}</span> : null}
    </div>
  );
});
