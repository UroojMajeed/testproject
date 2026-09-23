import { Link } from 'react-router-dom';
import { paths } from '../../routes/paths.js';

/**
 * The wordmark. A link everywhere except on the landing page itself, where it
 * would point at the page you are already on — and where the h1 is the real
 * heading, so this must not compete with it.
 */
export function Logo({ as = 'link', className = '' }) {
  const mark = <span className="logo">ReclaimOS</span>;

  if (as === 'plain') return <span className={className}>{mark}</span>;

  return (
    <Link to={paths.landing} className={`text-decoration-none ${className}`.trim()}>
      {mark}
    </Link>
  );
}
