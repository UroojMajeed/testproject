const VARIANT = {
  primary: 'btn-primary',
  outline: 'btn-outline-ink',
  quiet: 'btn-quiet',
  danger: 'btn-danger',
};

export function Button({
  variant = 'primary',
  type = 'button',
  loading = false,
  loadingLabel = 'Working',
  disabled,
  className = '',
  children,
  ...rest
}) {
  return (
    <button
      type={type}
      className={`btn ${VARIANT[variant] ?? VARIANT.primary} ${className}`}
      disabled={disabled || loading}
      // Tells assistive tech the control is busy rather than merely disabled.
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className="spinner-border spinner-border-sm" aria-hidden="true" />}
      {loading ? loadingLabel : children}
    </button>
  );
}
