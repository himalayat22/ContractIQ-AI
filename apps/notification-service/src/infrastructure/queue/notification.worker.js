import { Worker } from 'bullmq';
import { NOTIFICATION_JOB_NAMES } from './queues.js';
import { processSendNotificationJob } from '../../modules/notifications/jobs/sendNotification.job.js';

/**
 * @param {object} options
 * @param {import('ioredis').default} options.connection
 * @param {string} options.queueName
 * @param {import('../../modules/notifications/services/NotificationDispatchService.js').default} options.dispatchService
 */
export function createNotificationWorker({ connection, queueName, dispatchService }) {
  const worker = new Worker(
    queueName,
    async (job) => {
      if (job.name !== NOTIFICATION_JOB_NAMES.SEND) {
        console.warn(`[notification-worker] Unknown job name: ${job.name}`);
        return;
      }

      return processSendNotificationJob(job.data, dispatchService);
    },
    {
      connection,
      concurrency: Number(process.env.NOTIFICATION_WORKER_CONCURRENCY ?? 5),
    },
  );

  worker.on('completed', (job) => {
    console.log(`[notification-worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    console.error(`[notification-worker] Job ${job?.id} failed:`, error?.message ?? error);
  });

  return worker;
}
