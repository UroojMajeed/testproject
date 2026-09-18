/**
 * One figure, its unit, and what it means. `tone` separates verified numbers
 * from projected ones — the two never share a colour anywhere in this product.
 */
export function StatCard({ label, value, unit, caption, tone = 'ink' }) {
  const colour = { ink: 'var(--ink)', verified: 'var(--verified)', estimated: 'var(--estimated)', warn: 'var(--warn)' }[tone];

  return (
    <section className="surface p-3 h-100 stack gap-2">
      <h3 className="eyebrow mb-0">{label}</h3>
      <p className="mb-0 d-flex align-items-baseline gap-1">
        <span className="numeral" style={{ fontSize: '1.9rem', color: colour, lineHeight: 1 }}>{value}</span>
        {unit && <span className="numeral fs-ui" style={{ color: colour }}>{unit}</span>}
      </p>
      {caption && <p className="fs-caption text-muted-3 mb-0">{caption}</p>}
    </section>
  );
}
