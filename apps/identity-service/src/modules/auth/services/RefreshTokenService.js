import crypto from 'crypto';
import RefreshToken from '../models/RefreshToken.js';
import Session from '../models/Session.js';
import { signAccessToken } from '../utils/jwt.js';
import { AppError } from '../../../utils/AppError.js';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateOpaqueToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function getRefreshExpiresMs() {
  const seconds = Number(process.env.JWT_REFRESH_EXPIRES_IN ?? 604800);
  return (Number.isFinite(seconds) && seconds > 0 ? seconds : 604800) * 1000;
}

/**
 * Refresh token lifecycle: issue, rotate, revoke, session listing.
 * @see docs/DATABASE_DESIGN.md §4.2–4.3
 */
export default class RefreshTokenService {
  /**
   * Create refresh token + session and sign access token.
   */
  async issueTokenPair({ userId, tenantId, role, email, isSuperAdmin = false, context = {} }) {
    const opaque = generateOpaqueToken();
    const familyId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + getRefreshExpiresMs());

    const refreshDoc = await RefreshToken.create({
      userId,
      tokenHash: hashToken(opaque),
      familyId,
      expiresAt,
      userAgent: context.userAgent ?? null,
      ipAddress: context.ipAddress ?? null,
    });

    const session = await Session.create({
      userId,
      refreshTokenId: refreshDoc._id,
      userAgent: context.userAgent ?? null,
      ipAddress: context.ipAddress ?? null,
      lastActiveAt: new Date(),
    });

    const { accessToken, expiresIn } = signAccessToken({
      sub: userId,
      tid: tenantId,
      role,
      email,
      isSuperAdmin,
      sessionId: session._id,
    });

    return {
      accessToken,
      refreshToken: opaque,
      expiresIn,
      sessionId: session._id,
      refreshTokenId: refreshDoc._id,
    };
  }

  /**
   * Rotate refresh token; detects reuse and revokes token family.
   */
  async refresh(opaqueRefreshToken, context = {}) {
    if (!opaqueRefreshToken) {
      throw new AppError('Refresh token is required', {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }

    const tokenHash = hashToken(opaqueRefreshToken);
    const existing = await RefreshToken.findOne({ tokenHash });

    if (!existing) {
      throw new AppError('Invalid refresh token', {
        statusCode: 401,
        code: 'UNAUTHORIZED',
      });
    }

    if (existing.isExpired()) {
      throw new AppError('Refresh token expired', {
        statusCode: 401,
        code: 'UNAUTHORIZED',
      });
    }

    if (existing.isRevoked()) {
      await this.#revokeTokenFamily(existing.familyId);
      throw new AppError('Refresh token reuse detected', {
        statusCode: 401,
        code: 'UNAUTHORIZED',
      });
    }

    const session = await Session.findOne({ refreshTokenId: existing._id, userId: existing.userId });
    if (!session) {
      throw new AppError('Session not found for refresh token', {
        statusCode: 401,
        code: 'UNAUTHORIZED',
      });
    }

    const newOpaque = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + getRefreshExpiresMs());

    const newRefresh = await RefreshToken.create({
      userId: existing.userId,
      tokenHash: hashToken(newOpaque),
      familyId: existing.familyId,
      expiresAt,
      userAgent: context.userAgent ?? existing.userAgent,
      ipAddress: context.ipAddress ?? existing.ipAddress,
    });

    existing.revokedAt = new Date();
    existing.replacedByTokenId = newRefresh._id;
    await existing.save();

    session.refreshTokenId = newRefresh._id;
    session.lastActiveAt = new Date();
    if (context.userAgent) session.userAgent = context.userAgent;
    if (context.ipAddress) session.ipAddress = context.ipAddress;
    await session.save();

    const { accessToken, expiresIn } = signAccessToken({
      sub: String(existing.userId),
      tid: context.tenantId ?? null,
      role: context.role ?? null,
      email: context.email ?? null,
      isSuperAdmin: context.isSuperAdmin ?? false,
      sessionId: session._id,
    });

    return {
      accessToken,
      refreshToken: newOpaque,
      expiresIn,
      userId: existing.userId,
      sessionId: session._id,
    };
  }

  /**
   * Revoke a refresh token (logout).
   */
  async revoke(opaqueRefreshToken) {
    if (!opaqueRefreshToken) return;

    const tokenHash = hashToken(opaqueRefreshToken);
    const doc = await RefreshToken.findOne({ tokenHash });
    if (!doc || doc.isRevoked()) return;

    doc.revokedAt = new Date();
    await doc.save();

    await Session.deleteOne({ refreshTokenId: doc._id, userId: doc.userId });
  }

  /**
   * Revoke all refresh tokens in a family (compromise / reuse).
   */
  async #revokeTokenFamily(familyId) {
    const now = new Date();
    await RefreshToken.updateMany(
      { familyId, revokedAt: null },
      { $set: { revokedAt: now } },
    );
    const tokens = await RefreshToken.find({ familyId }).select('_id userId');
    const tokenIds = tokens.map((t) => t._id);
    if (tokenIds.length) {
      await Session.deleteMany({ refreshTokenId: { $in: tokenIds } });
    }
  }

  /**
   * List active sessions for a user.
   */
  async listSessions(userId, { currentSessionId } = {}) {
    const sessions = await Session.find({ userId }).sort({ lastActiveAt: -1 }).lean();

    return sessions.map((s) => ({
      sessionId: String(s._id),
      userAgent: s.userAgent ?? null,
      ipAddress: s.ipAddress ?? null,
      lastActiveAt: s.lastActiveAt?.toISOString?.() ?? s.lastActiveAt,
      createdAt: s.createdAt?.toISOString?.() ?? s.createdAt,
      current: currentSessionId != null && String(s._id) === String(currentSessionId),
    }));
  }

  /**
   * Revoke session and its refresh token.
   */
  async revokeSession(userId, sessionId) {
    const session = await Session.findOne({ _id: sessionId, userId });
    if (!session) {
      throw new AppError('Session not found', {
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    const token = await RefreshToken.findById(session.refreshTokenId);
    if (token && !token.isRevoked()) {
      token.revokedAt = new Date();
      await token.save();
    }

    await Session.deleteOne({ _id: sessionId, userId });
  }

  /**
   * Touch session activity (optional hook from authenticateJwt).
   */
  async touchSession(sessionId) {
    if (!sessionId) return;
    await Session.updateOne({ _id: sessionId }, { $set: { lastActiveAt: new Date() } });
  }
}
