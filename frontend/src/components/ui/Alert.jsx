/**
 * A message the user needs to read now.
 *
 * `role="alert"` on an error means it is announced the moment it appears, which is
 * the difference between a screen-reader user knowing the sign-in failed and
 * wondering why nothing happened. Successes use role="status" — polite, because
 * they are not urgent.
 *
 * Colour is never the only signal: each tone carries a text prefix too.
 */
const TONES = {
  error: { cls: 'alert-danger', role: 'alert', prefix: 'Error' },
  success: { cls: 'alert-success', role: 'status', prefix: 'Done' },
  info: { cls: 'alert-info', role: 'status', prefix: null },
};

export function Alert({ tone = 'info', children, className = '' }) {
  const { cls, role, prefix } = TONES[tone] ?? TONES.info;
  if (!children) return null;

  return (
    <div className={`alert ${cls} ${className}`.trim()} role={role} aria-live={role === 'alert' ? 'assertive' : 'polite'}>
      {prefix ? <strong className="me-1">{prefix}:</strong> : null}
      {children}
    </div>
  );
}
