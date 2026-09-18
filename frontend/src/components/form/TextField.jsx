import { forwardRef, useId } from 'react';

/**
 * A labelled input, wired for assistive tech:
 *  - a real <label for>, never a placeholder standing in for one
 *  - aria-invalid drives both the styling and the announcement
 *  - aria-describedby points at the hint and the error together
 */
export const TextField = forwardRef(function TextField(
  { label, error, hint, type = 'text', required, className = '', ...rest },
  ref,
) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

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

      <input
        ref={ref}
        id={id}
        type={type}
        className="form-control"
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        {...rest}
      />

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
