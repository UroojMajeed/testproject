const TONE = {
  error: { cls: 'border-danger-subtle bg-danger-subtle text-danger-emphasis', role: 'alert' },
  warn: { cls: 'chip-warn', role: 'status' },
  info: { cls: 'chip-neutral', role: 'status' },
  success: { cls: 'chip-verified', role: 'status' },
};

/**
 * role="alert" on errors so a screen reader announces a failed submit without
 * the user having to hunt for it.
 */
export function Alert({ tone = 'info', title, children, className = '' }) {
  const { cls, role } = TONE[tone] ?? TONE.info;
  return (
    <div className={`p-3 rounded border ${cls} ${className}`} role={role}>
      {title && <p className="mb-1 fw-semibold fs-ui">{title}</p>}
      <div className="fs-ui mb-0">{children}</div>
    </div>
  );
}
