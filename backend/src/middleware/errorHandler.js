import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';
import { ERROR_CODES } from '../config/constants.js';
import { isProd } from '../config/env.js';
import { logger } from '../config/logger.js';

/** The only place an error becomes a response body. */
export function errorHandler(err, req, res, _next) {
  let e = err;

  if (e instanceof mongoose.Error.ValidationError) {
    e = ApiError.unprocessable(
      'Some fields need attention',
      Object.values(err.errors).map((v) => ({ field: v.path, message: v.message })),
    );
  } else if (e instanceof mongoose.Error.CastError) {
    e = ApiError.badRequest(`Malformed value for ${err.path}`);
  } else if (e?.code === 11000) {
    e = ApiError.conflict(`That ${Object.keys(err.keyPattern ?? {})[0] ?? 'value'} is already taken`);
  } else if (err?.type === 'entity.too.large') {
    e = new ApiError(413, ERROR_CODES.VALIDATION_ERROR, 'That request body is too large');
  } else if (err?.type === 'entity.parse.failed') {
    e = ApiError.badRequest('Request body is not valid JSON');
  } else if (err?.type === 'entity.verify.failed' || err?.status === 400) {
    e = ApiError.badRequest('Malformed request');
  } else if (!(e instanceof ApiError)) {
    e = new ApiError(500, ERROR_CODES.INTERNAL, 'Something went wrong on our side');
  }

  const log = e.statusCode >= 500 ? logger.error.bind(logger) : logger.warn.bind(logger);
  log({ err, statusCode: e.statusCode, code: e.code, path: req.originalUrl, method: req.method }, e.message);

  const body = { success: false, error: { code: e.code, message: e.message } };
  if (e.details) body.error.details = e.details;
  // Stacks are for the logs, never for the client, in production.
  if (!isProd && e.statusCode >= 500) body.error.stack = err.stack;

  res.status(e.statusCode).json(body);
}
