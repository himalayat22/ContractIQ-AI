import { AppError } from '../utils/AppError.js';

export function notFoundHandler(req, _res, next) {
  next(
    new AppError(`Route not found: ${req.method} ${req.originalUrl}`, {
      statusCode: 404,
      code: 'RESOURCE_NOT_FOUND',
    }),
  );
}
