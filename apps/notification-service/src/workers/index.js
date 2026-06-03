import { createRedisConnection, getSharedRedisConnection } from '../infrastructure/redis/connection.js';
import { createNotificationQueue, enqueueNotificationSend } from '../infrastructure/queue/notification.queue.js';
import { createNotificationWorker } from '../infrastructure/queue/notification.worker.js';
import EmailService from '../modules/notifications/services/EmailService.js';
import NotificationDispatchService from '../modules/notifications/services/NotificationDispatchService.js';
import { InternalNotificationController } from '../modules/notifications/controllers/InternalNotificationController.js';

/**
 * Wire Redis, BullMQ queue/worker, email, and internal enqueue handler.
 * @param {import('../config/env.js').ReturnType<import('../config/env.js').getConfig>} config
 */
export function createNotificationRuntime(config) {
  const queueConnection = getSharedRedisConnection(config.redisUrl);
  const workerConnection = createRedisConnection(config.redisUrl);

  const queue = createNotificationQueue(queueConnection, config.notificationQueueName);

  const emailService = new EmailService({
    smtp: config.smtp,
    emailFrom: config.emailFrom,
    emailFromName: config.emailFromName,
  });

  const dispatchService = new NotificationDispatchService({
    emailService,
    webUrl: config.webUrl,
  });

  const worker = config.runWorker
    ? createNotificationWorker({
        connection: workerConnection,
        queueName: config.notificationQueueName,
        dispatchService,
      })
    : null;

  const internalNotificationController = new InternalNotificationController({
    enqueueNotification: (payload) => enqueueNotificationSend(queue, payload),
  });

  return {
    queue,
    worker,
    queueConnection,
    workerConnection,
    internalNotificationController,
    async close() {
      if (worker) {
        await worker.close();
      }
      await queue.close();
      if (workerConnection !== queueConnection) {
        await workerConnection.quit();
      }
      await queueConnection.quit();
    },
  };
}
