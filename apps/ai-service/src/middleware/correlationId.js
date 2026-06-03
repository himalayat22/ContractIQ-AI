import { randomUUID } from 'node:crypto';

export function correlationId(req, res, next) {
  const incoming = req.headers['x-request-id'];
  const id = typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();

  req.id = id;
  res.setHeader('X-Request-ID', id);
  next();
}
