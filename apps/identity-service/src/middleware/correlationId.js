import { randomUUID } from 'crypto';

export function correlationId(req, res, next) {
  const id = req.headers['x-request-id'] ?? randomUUID();
  req.id = id;
  res.setHeader('X-Request-ID', id);
  next();
}
