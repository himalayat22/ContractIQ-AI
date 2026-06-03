import NotificationService from '../services/NotificationService.js';

function buildMeta(req) {
  return {
    requestId: req.headers['x-request-id'] ?? req.id ?? null,
    timestamp: new Date().toISOString(),
  };
}

function sendSuccess(res, statusCode, data, req, pagination) {
  return res.status(statusCode).json({
    success: true,
    data,
    ...(pagination ? { pagination } : {}),
    meta: buildMeta(req),
  });
}

/**
 * User-facing notification APIs (JWT+T enforced at gateway).
 * @see docs/API_DESIGN.md §9
 */
export class NotificationController {
  constructor(notificationService = new NotificationService()) {
    this.notificationService = notificationService;
  }

  list = async (req, res, next) => {
    try {
      const tenantId = req.headers['x-tenant-id'];
      const userId = req.headers['x-user-id'] ?? req.user?.sub;

      const result = await this.notificationService.listForUser({
        tenantId,
        userId,
        ...req.validatedQuery,
      });

      return sendSuccess(res, 200, result.data, req, result.pagination);
    } catch (error) {
      return next(error);
    }
  };

  unreadCount = async (req, res, next) => {
    try {
      const tenantId = req.headers['x-tenant-id'];
      const userId = req.headers['x-user-id'] ?? req.user?.sub;
      const data = await this.notificationService.getUnreadCount(tenantId, userId);
      return sendSuccess(res, 200, data, req);
    } catch (error) {
      return next(error);
    }
  };

  markRead = async (req, res, next) => {
    try {
      const tenantId = req.headers['x-tenant-id'];
      const userId = req.headers['x-user-id'] ?? req.user?.sub;
      const data = await this.notificationService.markRead({
        tenantId,
        userId,
        notificationId: req.params.id,
      });
      return sendSuccess(res, 200, data, req);
    } catch (error) {
      return next(error);
    }
  };

  markAllRead = async (req, res, next) => {
    try {
      const tenantId = req.headers['x-tenant-id'];
      const userId = req.headers['x-user-id'] ?? req.user?.sub;
      const data = await this.notificationService.markAllRead(tenantId, userId);
      return sendSuccess(res, 200, data, req);
    } catch (error) {
      return next(error);
    }
  };
}

export default new NotificationController();
