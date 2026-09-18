export function FullPageSpinner({ label = 'Loading' }) {
  return (
    <div className="auth-shell" role="status" aria-live="polite">
      <div className="text-center stack gap-3">
        <div className="spinner-border text-secondary" aria-hidden="true" />
        <span className="fs-ui text-muted-3">{label}…</span>
      </div>
    </div>
  );
}
