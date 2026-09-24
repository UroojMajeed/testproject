import { forwardRef, useId } from 'react';

/**
 * A labelled input with a unit after it — hours, a currency symbol.
 *
 * The suffix is `aria-hidden` and repeated inside the label instead. A screen
 * reader announcing "Hours a week, edit text, h" is worse than useless; the label
 * has to carry the unit itself.
 */
export const Field = forwardRef(function Field(
  { label, hint, error, suffix, prefix, className = '', ...rest },
  ref,
) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`mb-4 ${className}`.trim()}>
      <label className="form-label" htmlFor={id}>{label}</label>

      <div className={prefix || suffix ? 'input-group' : undefined}>
        {prefix ? <span className="input-group-text" aria-hidden="true">{prefix}</span> : null}
        <input
          {...rest}
          ref={ref}
          id={id}
          className="form-control"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
        />
        {suffix ? <span className="input-group-text" aria-hidden="true">{suffix}</span> : null}
      </div>

      {hint ? <span className="field-hint" id={hintId}>{hint}</span> : null}
      {error ? <span className="field-error" id={errorId}>{error}</span> : null}
    </div>
  );
});
