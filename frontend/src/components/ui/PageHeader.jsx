export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <header className="d-flex flex-wrap align-items-end gap-3 mb-4">
      <div className="stack gap-1 flex-grow-1">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2 className="display-serif mb-0" style={{ fontSize: '1.9rem' }}>{title}</h2>
        {subtitle && <p className="fs-ui text-muted-3 mb-0">{subtitle}</p>}
      </div>
      {actions && <div className="d-flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
