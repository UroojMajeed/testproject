import { ApiError } from '../utils/ApiError.js';

/**
 * validate({ body, query, params }) — every route that accepts input uses this.
 * Parsed output replaces the raw input, so downstream code only ever sees values
 * that matched the schema, with unknown keys stripped.
 */
export const validate = (schemas) => (req, _res, next) => {
  const details = [];

  for (const key of ['params', 'query', 'body']) {
    const schema = schemas[key];
    if (!schema) continue;

    const result = schema.safeParse(req[key]);
    if (!result.success) {
      for (const issue of result.error.issues) {
        details.push({ field: [key, ...issue.path].join('.'), message: issue.message, code: issue.code });
      }
      continue;
    }

    if (key === 'query') {
      // req.query has no setter in some Express versions — mutate in place.
      for (const k of Object.keys(req.query)) delete req.query[k];
      Object.assign(req.query, result.data);
    } else {
      req[key] = result.data;
    }
  }

  if (details.length) return next(ApiError.unprocessable('Some fields need attention', details));
  return next();
};
