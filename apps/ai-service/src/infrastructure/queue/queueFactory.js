import { Queue } from 'bullmq';

/**
 * @param {import('ioredis').default} connection
 * @param {string} queueName
 */
export function createQueue(connection, queueName) {
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
