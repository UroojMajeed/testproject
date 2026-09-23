/**
 * The boot state. `role="status"` plus the label means a screen reader says
 * something is happening rather than sitting in silence.
 */
export function FullPageSpinner({ label = 'Loading' }) {
  return (
    <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '60vh' }}>
      <div className="text-center" role="status" aria-live="polite">
        <div className="spinner-border text-primary" aria-hidden="true" />
        <p className="mt-3 mb-0" style={{ color: 'var(--ink-muted)' }}>{label}</p>
      </div>
    </div>
  );
}
