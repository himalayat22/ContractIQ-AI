import { AppError } from '../utils/AppError.js';

function buildMeta(req) {
  return {
    requestId: req.headers['x-request-id'] ?? req.id ?? null,
    timestamp: new Date().toISOString(),
  };
}

export function errorHandler(err, req, res, _next) {
  if (res.headersSent) {
    return;
  }

  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const code = err instanceof AppError ? err.code : 'INTERNAL_ERROR';
  const message =
    err instanceof AppError
      ? err.message
      : process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message;

  const details = err instanceof AppError ? err.details : [];

  if (statusCode >= 500) {
    console.error('[identity-service]', err);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta: buildMeta(req),
  });
}
