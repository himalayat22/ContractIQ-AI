import { Router } from 'express';
import notificationController from '../controllers/NotificationController.js';
import {
  validateListNotificationsQuery,
  validateNotificationIdParams,
} from '../validations/notification.validation.js';

/**
 * `/api/v1/notifications/*` — API_DESIGN.md §9
 */
const notificationRoutes = Router();

notificationRoutes.get('/', validateListNotificationsQuery, notificationController.list);
notificationRoutes.get('/unread-count', notificationController.unreadCount);
notificationRoutes.patch('/:id/read', validateNotificationIdParams, notificationController.markRead);
notificationRoutes.post('/read-all', notificationController.markAllRead);

export default notificationRoutes;
