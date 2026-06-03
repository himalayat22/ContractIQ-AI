import { Queue } from 'bullmq';
import { NOTIFICATION_JOB_NAMES } from './queues.js';

/**
 * @param {import('ioredis').default} connection
 * @param {string} queueName
 */
export function createNotificationQueue(connection, queueName) {
  return new Queue(queueName, {
    connection,
    defaultJobOptions: {
      removeOnComplete: 1000,
      removeOnFail: 5000,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    },
  });
}

/**
 * Enqueue a notification dispatch job (MVP — SYSTEM_DESIGN §0.8).
 * @param {Queue} queue
 * @param {import('../../modules/notifications/jobs/sendNotification.job.js').NotificationSendJobPayload} payload
 */
export async function enqueueNotificationSend(queue, payload) {
  return queue.add(NOTIFICATION_JOB_NAMES.SEND, payload, {
    jobId: payload.correlationId ? `notify-${payload.correlationId}` : undefined,
  });
}
