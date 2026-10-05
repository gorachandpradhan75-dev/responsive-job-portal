'use strict';

class ApiError extends Error {
  constructor(status, message, { code, errors } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}

const badRequest = (msg = 'Bad request', errors) => new ApiError(400, msg, { code: 'BAD_REQUEST', errors });
const unauthorized = (msg = 'Authentication required', code = 'UNAUTHORIZED') =>
  new ApiError(401, msg, { code });
const forbidden = (msg = 'You do not have permission to access this resource') =>
  new ApiError(403, msg, { code: 'FORBIDDEN' });
const notFound = (msg = 'Resource not found') => new ApiError(404, msg, { code: 'NOT_FOUND' });
const conflict = (msg = 'Resource already exists', errors) =>
  new ApiError(409, msg, { code: 'CONFLICT', errors });

module.exports = { ApiError, badRequest, unauthorized, forbidden, notFound, conflict };
