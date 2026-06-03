import { Router } from 'express';
import healthRoutes from './health.routes.js';
import notificationRoutes from '../modules/notifications/routes/notificationRoutes.js';
import { createInternalRoutes } from '../modules/notifications/routes/internalRoutes.js';

/**
 * @param {{ internalNotificationController: import('../modules/notifications/controllers/InternalNotificationController.js').InternalNotificationController }} deps
 */
export function createApiRouter({ internalNotificationController }) {
  const apiRouter = Router();

  apiRouter.use(healthRoutes);
  apiRouter.use('/notifications', notificationRoutes);
  apiRouter.use('/internal', createInternalRoutes(internalNotificationController));

  return apiRouter;
}
