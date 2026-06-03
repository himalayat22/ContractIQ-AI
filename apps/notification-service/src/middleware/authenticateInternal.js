function buildMeta(req) {
  return {
    requestId: req.headers['x-request-id'] ?? req.id ?? null,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Validates `X-Internal-Api-Key` for service-to-service routes (MVP).
 */
export function authenticateInternal(req, res, next) {
  const expected = process.env.INTERNAL_API_KEY;

  if (!expected) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'INTERNAL_API_KEY is not configured',
        details: [],
      },
      meta: buildMeta(req),
    });
  }

  const provided = req.headers['x-internal-api-key'];

  if (!provided || provided !== expected) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid internal API key',
        details: [],
      },
      meta: buildMeta(req),
    });
  }

  return next();
}
