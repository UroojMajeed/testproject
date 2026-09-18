/**
 * Strips keys beginning with `$` or containing `.` from request payloads, so a
 * body like { email: { $ne: null } } cannot become a Mongo operator.
 *
 * Written by hand rather than using express-mongo-sanitize: that package
 * reassigns req.query, which throws on Express versions where it is a getter.
 */
const MAX_DEPTH = 12;

function scrub(value, depth = 0) {
  if (depth > MAX_DEPTH || value === null || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) value[i] = scrub(value[i], depth + 1);
    return value;
  }

  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.') || key === '__proto__' || key === 'constructor') {
      delete value[key];
    } else {
      value[key] = scrub(value[key], depth + 1);
    }
  }
  return value;
}

export function sanitize(req, _res, next) {
  if (req.body) scrub(req.body);
  if (req.params) scrub(req.params);
  if (req.query) scrub(req.query);
  next();
}
