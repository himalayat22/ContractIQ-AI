import { Worker } from 'bullmq';
import { ANALYSIS_COMPLETE_JOB_NAMES } from './queues.js';
import { processAnalysisCompleteJob } from '../../modules/analysis/jobs/analysisComplete.job.js';

/**
 * @param {object} options
 * @param {import('ioredis').default} options.connection
 * @param {string} options.queueName
 * @param {import('../../modules/contracts/repositories/ContractRepository.js').default} options.contractRepository
 * @param {import('../clients/NotificationClient.js').NotificationClient} options.notificationClient
 * @param {number} [options.concurrency]
 */
export function createAnalysisCompleteWorker({
  connection,
  queueName,
  contractRepository,
  notificationClient,
  concurrency,
}) {
  const worker = new Worker(
    queueName,
    async (job) => {
      if (job.name !== ANALYSIS_COMPLETE_JOB_NAMES.COMPLETE) {
        console.warn(`[analysis-complete-worker] Unknown job name: ${job.name}`);
        return;
      }

      return processAnalysisCompleteJob(job.data, {
        contractRepository,
        notificationClient,
      });
    },
    {
      connection,
      concurrency: concurrency ?? Number(process.env.CONTRACT_ANALYSIS_COMPLETE_WORKER_CONCURRENCY ?? 5),
    },
  );

  worker.on('completed', (job) => {
    console.log(`[analysis-complete-worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    console.error(`[analysis-complete-worker] Job ${job?.id} failed:`, error?.message ?? error);
  });

  return worker;
}
