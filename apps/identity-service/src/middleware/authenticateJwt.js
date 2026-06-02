import { verifyAccessToken } from '../modules/auth/utils/jwt.js';
import { AppError } from '../utils/AppError.js';

/**
 * Validates `Authorization: Bearer <accessToken>` and attaches decoded claims to `req.user`.
 * @see docs/API_DESIGN.md §2 (JWT)
 */
export function authenticateJwt(req, _res, next) {
  try {
    const header = req.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new AppError('Missing or invalid Authorization header', {
        statusCode: 401,
        code: 'UNAUTHORIZED',
      });
    }

    const token = header.slice(7).trim();
    if (!token) {
      throw new AppError('Missing bearer token', {
        statusCode: 401,
        code: 'UNAUTHORIZED',
      });
    }

    const decoded = verifyAccessToken(token);

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
    return next(error);
  }
}

/**
 * Ensures `X-Tenant-ID` matches JWT `tid` (JWT+T routes).
 */
export function validateTenantHeader(req, _res, next) {
  try {
    const headerTenantId = req.headers['x-tenant-id'];
    const jwtTenantId = req.user?.tid ?? req.user?.tenantId;

    if (!headerTenantId) {
      throw new AppError('X-Tenant-ID header is required', {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }

    if (!jwtTenantId || String(headerTenantId) !== String(jwtTenantId)) {
      throw new AppError('Tenant header does not match token', {
        statusCode: 403,
        code: 'TENANT_MISMATCH',
      });
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

/**
 * Minimum role guard — use after authenticateJwt (+ validateTenantHeader when needed).
 */
export function requireRole(...allowedRoles) {
  const hierarchy = ['viewer', 'business_user', 'legal_reviewer', 'tenant_admin', 'super_admin'];

  return (req, _res, next) => {
    try {
      if (req.user?.isSuperAdmin) {
        return next();
      }

      const role = req.user?.role;
      if (!role) {
        throw new AppError('Role not present on token', {
          statusCode: 403,
          code: 'FORBIDDEN',
        });
      }

      const userRank = hierarchy.indexOf(role);
      const minRequired = Math.min(
        ...allowedRoles.map((r) => {
          const idx = hierarchy.indexOf(r);
          return idx === -1 ? Infinity : idx;
        }),
      );

      if (userRank === -1 || userRank < minRequired) {
        throw new AppError('Insufficient permissions', {
          statusCode: 403,
          code: 'FORBIDDEN',
        });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}
