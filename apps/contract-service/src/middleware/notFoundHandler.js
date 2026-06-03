function buildMeta(req) {
  return {
    requestId: req.headers['x-request-id'] ?? req.id ?? null,
    timestamp: new Date().toISOString(),
  };
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
      details: [],
    },
    meta: buildMeta(req),
  });
}
