export function Skeleton({ height = 80, className = '' }) {
  return (
    <div
      className={`rounded ${className}`}
      style={{ height, background: 'var(--sunken)' }}
      role="status"
      aria-label="Loading"
    />
  );
}

export function SkeletonGrid({ count = 4, height = 96 }) {
  return (
    <div className="row g-3">
      {Array.from({ length: count }, (_, i) => (
        <div className="col-12 col-sm-6 col-xl-3" key={i}>
          <Skeleton height={height} />
        </div>
      ))}
    </div>
  );
}
