import jwt from 'jsonwebtoken';

function meta(req) {
  return {
    requestId: req.headers['x-request-id'] ?? req.id ?? null,
    timestamp: new Date().toISOString(),
  };
}

function sendError(res, req, statusCode, code, message) {
  return res.status(statusCode).json({
    success: false,
    error: { code, message, details: [] },
    meta: meta(req),
  });
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
}

/**
 * Verify HS256 access token (MVP — API_DESIGN.md §2).
 * Attaches decoded claims to `req.user`.
 */
export function verifyJwt(req, res, next) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return sendError(res, req, 401, 'UNAUTHORIZED', 'Missing or invalid Authorization header');
  }

  const token = header.slice(7).trim();
  if (!token) {
    return sendError(res, req, 401, 'UNAUTHORIZED', 'Missing bearer token');
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });

    req.user = {
      sub: decoded.sub,
      userId: decoded.sub,
      tid: decoded.tid ?? null,
      tenantId: decoded.tid ?? null,
      role: decoded.role ?? null,
      email: decoded.email ?? null,
      isSuperAdmin: Boolean(decoded.isSuperAdmin),
      sessionId: decoded.sessionId ?? null,
    };

    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return sendError(res, req, 401, 'UNAUTHORIZED', 'Access token expired');
    }
    return sendError(res, req, 401, 'UNAUTHORIZED', 'Invalid access token');
  }
}

/**
 * Ensures `X-Tenant-ID` matches JWT `tid` (JWT+T routes — SYSTEM_DESIGN §0.10).
 */
export function validateTenantHeader(req, res, next) {
  const headerTenantId = req.headers['x-tenant-id'];
  const jwtTenantId = req.user?.tid ?? req.user?.tenantId;

  if (!headerTenantId) {
    return sendError(res, req, 400, 'VALIDATION_ERROR', 'X-Tenant-ID header is required');
  }

  if (!jwtTenantId || String(headerTenantId) !== String(jwtTenantId)) {
    return sendError(res, req, 403, 'TENANT_MISMATCH', 'Tenant header does not match token');
  }

  return next();
}
