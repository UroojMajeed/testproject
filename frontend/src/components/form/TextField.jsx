import { forwardRef, useId } from 'react';

/**
 * One text input, wired for a screen reader.
 *
 * The three pieces people leave out, and what each one costs:
 *   - `htmlFor`/`id`: without it the label is decoration, and clicking it does
 *     nothing. A voice-control user cannot say "click email" either.
 *   - `aria-describedby`: without it the hint and the error message are on screen
 *     but never read out, so the user hears "Email, invalid" and no reason why.
 *   - `aria-invalid`: this is what makes assistive tech announce the field as
 *     wrong. A red border alone says nothing to someone who cannot see it.
 *
 * autoComplete is not politeness either — it is what lets a password manager fill
 * the form, which is the single biggest thing we can do for real password hygiene.
 */
export const TextField = forwardRef(function TextField(
  { label, hint, error, type = 'text', autoComplete, required, className = '', ...rest },
  ref,
) {
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

      <input
        {...rest}
        ref={ref}
        id={id}
        type={type}
        className="form-control"
        autoComplete={autoComplete}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        aria-required={required ? 'true' : undefined}
      />

      {hint ? <span className="field-hint" id={hintId}>{hint}</span> : null}
      {error ? <span className="field-error" id={errorId}>{error}</span> : null}
    </div>
  );
});
