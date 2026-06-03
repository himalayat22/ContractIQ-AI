import { AppError } from '../../../utils/AppError.js';

function buildMeta(req) {
  return {
    requestId: req.headers['x-request-id'] ?? req.id ?? null,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Service-to-service endpoints (internal API key).
 */
export class InternalNotificationController {
  constructor({ enqueueNotification }) {
    this.enqueueNotification = enqueueNotification;
  }

  notify = async (req, res, next) => {
    try {
      if (!this.enqueueNotification) {
        throw new AppError('Notification queue is not available', {
          statusCode: 503,
          code: 'SERVICE_UNAVAILABLE',
        });
      }

      const job = await this.enqueueNotification(req.body);

      return res.status(202).json({
        success: true,
        data: {
          jobId: job.id,
          status: 'queued',
          message: 'Notification dispatch queued',
        },
        meta: buildMeta(req),
      });
    } catch (error) {
      return next(error);
    }
  };
}
