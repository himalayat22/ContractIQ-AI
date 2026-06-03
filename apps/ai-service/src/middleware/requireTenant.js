function buildMeta(req) {
  return {
    requestId: req.headers['x-request-id'] ?? req.id ?? null,
    timestamp: new Date().toISOString(),
  };
}

/**
 * MVP tenant scoping via `X-Tenant-ID` (gateway sets this on JWT+T routes).
 */
export function requireTenant(req, res, next) {
  const tenantId = req.headers['x-tenant-id'];

  if (!tenantId) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'X-Tenant-ID header is required',
        details: [],
      },
      meta: buildMeta(req),
    });
  }

  req.tenantId = tenantId;
  return next();
}
