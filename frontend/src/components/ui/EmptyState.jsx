/**
 * Every list screen ships this rather than an empty grid. In this product the
 * first week IS the empty state, so it gets a real action, not an apology.
 */
export function EmptyState({ title, children, action, className = '' }) {
  return (
    <section className={`surface p-4 p-sm-5 text-center ${className}`}>
      <div className="mx-auto stack gap-3" style={{ maxWidth: '42ch' }}>
        <h3 className="display-serif mb-0" style={{ fontSize: '1.5rem' }}>{title}</h3>
        {children && <p className="fs-ui text-muted-2 mb-0">{children}</p>}
        {action && <div className="d-flex justify-content-center pt-1">{action}</div>}
      </div>
    </section>
  );
}
