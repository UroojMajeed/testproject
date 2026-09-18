/**
 * Forwards a rejected promise to Express's error pipeline.
 * Express 4 does not do this natively, so every async route is wrapped.
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
