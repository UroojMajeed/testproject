export function Logo({ size = '1.35rem', className = '' }) {
  return (
    <span className={`display-serif ${className}`} style={{ fontSize: size }}>
      ReclaimOS
    </span>
  );
}
