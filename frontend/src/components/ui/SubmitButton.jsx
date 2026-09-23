/**
 * A submit button that cannot be double-clicked into two sign-ups.
 *
 * While pending it stays the same width and keeps a label, rather than collapsing
 * to a bare spinner — a button that changes size under the cursor is how people
 * click the wrong thing.
 */
export function SubmitButton({ pending, children, pendingLabel = 'Working…', className = '' }) {
  return (
    <button type="submit" className={`btn btn-primary w-100 ${className}`.trim()} disabled={pending}>
      {pending ? (
        <>
          <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
