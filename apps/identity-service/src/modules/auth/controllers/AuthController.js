import AuthService from '../services/AuthService.js';

function buildMeta(req) {
  return {
    requestId: req.headers['x-request-id'] ?? req.id ?? null,
    timestamp: new Date().toISOString(),
  };
}

function sendSuccess(res, statusCode, data, req) {
  return res.status(statusCode).json({
    success: true,
    data,
    meta: buildMeta(req),
  });
}

function sendNoContent(res) {
  return res.status(204).send();
}

function requestContext(req) {
  return {
    userAgent: req.get('user-agent') ?? undefined,
    ipAddress: req.ip ?? req.socket?.remoteAddress,
  };
}

/**
 * HTTP handlers for /api/v1/auth/* (API_DESIGN.md §4).
 * Business logic lives in AuthService.
 */
export class AuthController {
  constructor(authService = new AuthService()) {
    this.authService = authService;
  }

  register = async (req, res, next) => {
    try {
      const data = await this.authService.register(req.body, requestContext(req));
      return sendSuccess(res, 201, data, req);
    } catch (error) {
      return next(error);
    }
  };

  login = async (req, res, next) => {
    try {
      const data = await this.authService.login(req.body, requestContext(req));
      return sendSuccess(res, 200, data, req);
    } catch (error) {
      return next(error);
    }
  };

  refresh = async (req, res, next) => {
    try {
      const data = await this.authService.refresh(req.body, requestContext(req));
      return sendSuccess(res, 200, data, req);
    } catch (error) {
      return next(error);
    }
  };

  logout = async (req, res, next) => {
    try {
      await this.authService.logout({
        userId: req.user?.sub ?? req.user?.userId,
        refreshToken: req.body?.refreshToken,
        context: requestContext(req),
      });
      return sendNoContent(res);
    } catch (error) {
      return next(error);
    }
  };

  forgotPassword = async (req, res, next) => {
    try {
      const data = await this.authService.forgotPassword(req.body);
      return sendSuccess(res, 200, data, req);
    } catch (error) {
      return next(error);
    }
  };

  resetPassword = async (req, res, next) => {
    try {
      const data = await this.authService.resetPassword(req.body);
      return sendSuccess(res, 200, data, req);
    } catch (error) {
      return next(error);
    }
  };

  verifyEmail = async (req, res, next) => {
    try {
      const data = await this.authService.verifyEmail(req.params.token);
      return sendSuccess(res, 200, data, req);
    } catch (error) {
      return next(error);
    }
  };

  me = async (req, res, next) => {
    try {
      const userId = req.user?.sub ?? req.user?.userId;
      const data = await this.authService.getMe(userId);
      return sendSuccess(res, 200, data, req);
    } catch (error) {
      return next(error);
    }
  };

  switchTenant = async (req, res, next) => {
    try {
      const userId = req.user?.sub ?? req.user?.userId;
      const data = await this.authService.switchTenant(
        userId,
        req.body?.tenantId,
        requestContext(req),
      );
      return sendSuccess(res, 200, data, req);
    } catch (error) {
      return next(error);
    }
  };

  listSessions = async (req, res, next) => {
    try {
      const userId = req.user?.sub ?? req.user?.userId;
      const data = await this.authService.listSessions(userId, {
        currentSessionId: req.user?.sessionId,
      });
      return sendSuccess(res, 200, data, req);
    } catch (error) {
      return next(error);
    }
  };

  revokeSession = async (req, res, next) => {
    try {
      const userId = req.user?.sub ?? req.user?.userId;
      await this.authService.revokeSession(userId, req.params.sessionId);
      return sendNoContent(res);
    } catch (error) {
      return next(error);
    }
  };
}

export default new AuthController();
