import jwt from 'jsonwebtoken';
import { AppError } from '../../../utils/AppError.js';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
}

function getAccessExpiresIn() {
  const raw = process.env.JWT_ACCESS_EXPIRES_IN ?? '900';
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 900;
}

/**
 * Sign HS256 access token (MVP — API_DESIGN.md §2).
 * Claims: sub, tid, role, email, isSuperAdmin, sessionId (optional)
 */
export function signAccessToken(payload) {
  const { sub, tid, role, email, isSuperAdmin = false, sessionId } = payload;

  if (!sub) {
    throw new AppError('Cannot sign token without subject', {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
    });
  }

  const expiresIn = getAccessExpiresIn();
  const token = jwt.sign(
    {
      sub: String(sub),
      ...(tid != null ? { tid: String(tid) } : {}),
      ...(role != null ? { role } : {}),
      ...(email != null ? { email } : {}),
      isSuperAdmin: Boolean(isSuperAdmin),
      ...(sessionId != null ? { sessionId: String(sessionId) } : {}),
    },
    getJwtSecret(),
    { algorithm: 'HS256', expiresIn },
  );

  return { accessToken: token, expiresIn };
}

/**
 * Verify Bearer access token; returns decoded claims.
 */
export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Access token expired', {
        statusCode: 401,
        code: 'UNAUTHORIZED',
      });
    }
    throw new AppError('Invalid access token', {
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
  }
}
