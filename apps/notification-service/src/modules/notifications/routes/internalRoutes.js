import { Router } from 'express';
import { authenticateInternal } from '../../../middleware/authenticateInternal.js';
import { validateInternalNotifyBody } from '../validations/notification.validation.js';

/**
 * Internal routes — `POST /api/v1/internal/notify`
 */
export function createInternalRoutes(internalController) {
  const router = Router();

  router.post(
    '/notify',
    authenticateInternal,
    validateInternalNotifyBody,
    internalController.notify,
  );

  return router;
}
