const TONE = {
  neutral: 'chip-neutral',
  verified: 'chip-verified',
  estimated: 'chip-estimated',
  warn: 'chip-warn',
};

export function Chip({ tone = 'neutral', children, className = '', ...rest }) {
  return (
    <span className={`chip ${TONE[tone] ?? TONE.neutral} ${className}`} {...rest}>
      {children}
    </span>
  );
}

const QUADRANT = {
  delegation: { label: 'Delegation', color: 'var(--drip-delegation)', text: '#b75129', bg: '#fdf2ec', border: '#f5dccc' },
  replacement: { label: 'Replacement', color: 'var(--drip-replacement)', text: '#4a3aa7', bg: '#f1eff9', border: '#dfdaf0' },
  investment: { label: 'Investment', color: 'var(--drip-investment)', text: '#2771c9', bg: '#eaf2fc', border: '#d2e3f8' },
  production: { label: 'Production', color: 'var(--drip-production)', text: '#14815a', bg: '#eaf7f2', border: '#cdebe0' },
};

export const quadrantStyle = (q) => QUADRANT[q] ?? null;

/**
 * Quadrant identity is carried by the label AND the dot, never by colour alone —
 * the text variants are darkened so they clear 4.5:1 while the dot keeps the
 * validated categorical fill.
 */
export function QuadrantChip({ quadrant, className = '' }) {
  const q = QUADRANT[quadrant];
  if (!q) return <span className={`chip chip-neutral ${className}`}>Unclassified</span>;

  return (
    <span
      className={`chip ${className}`}
      style={{ color: q.text, background: q.bg, borderColor: q.border }}
    >
      <span className="drip-dot" style={{ background: q.color }} aria-hidden="true" />
      {q.label}
    </span>
  );
}

export function DripDot({ quadrant, size = 8 }) {
  const q = QUADRANT[quadrant];
  return (
    <span
      className="drip-dot"
      style={{ width: size, height: size, background: q?.color ?? 'var(--line-strong)' }}
      aria-hidden="true"
    />
  );
}
