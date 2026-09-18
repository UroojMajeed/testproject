import { ERROR_CODES } from '../config/constants.js';

/** The only error type services throw. errorHandler is the only thing that formats it. */
export class ApiError extends Error {
  constructor(statusCode, code, message, details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(msg, details) { return new ApiError(400, ERROR_CODES.VALIDATION_ERROR, msg, details); }
  static unauthenticated(msg = 'Authentication required', code = ERROR_CODES.UNAUTHENTICATED) {
    return new ApiError(401, code, msg);
  }
  static forbidden(msg = 'You do not have access to this') { return new ApiError(403, ERROR_CODES.FORBIDDEN, msg); }
  static notFound(msg = 'Not found') { return new ApiError(404, ERROR_CODES.NOT_FOUND, msg); }
  static conflict(msg) { return new ApiError(409, ERROR_CODES.CONFLICT, msg); }
  static unprocessable(msg, details) { return new ApiError(422, ERROR_CODES.VALIDATION_ERROR, msg, details); }
  static locked(msg) { return new ApiError(423, ERROR_CODES.ACCOUNT_LOCKED, msg); }
}
