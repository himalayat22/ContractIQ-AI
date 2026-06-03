import { z } from 'zod';
import { NOTIFICATION_TYPES, RESOURCE_TYPES } from '../models/Notification.js';
import { validateBody, validateParams, validateQuery } from '../../../middleware/validateRequest.js';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id format');

export const listNotificationsQuerySchema = z.object({
  read: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  type: z.enum(NOTIFICATION_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const notificationIdParamsSchema = z.object({
  id: objectIdSchema,
});

export const internalNotifyBodySchema = z.object({
  tenantId: objectIdSchema,
  userId: objectIdSchema,
  type: z.enum(NOTIFICATION_TYPES),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(1000),
  resourceType: z.enum(RESOURCE_TYPES),
  resourceId: objectIdSchema,
  metadata: z.record(z.unknown()).optional(),
  correlationId: z.string().min(1).max(128).optional(),
  email: z
    .object({
      to: z.string().email(),
      templateId: z.string().trim().min(1).optional(),
      templateData: z.record(z.unknown()).optional(),
      subject: z.string().trim().min(1).max(500).optional(),
    })
    .optional(),
});

export const validateListNotificationsQuery = validateQuery(listNotificationsQuerySchema);
export const validateNotificationIdParams = validateParams(notificationIdParamsSchema);
export const validateInternalNotifyBody = validateBody(internalNotifyBodySchema);
