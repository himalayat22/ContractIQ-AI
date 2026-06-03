import { Worker } from 'bullmq';
import { AI_ANALYZE_JOB_NAMES } from './queues.js';
import { processRunAnalysisJob } from '../../modules/analysis/jobs/runAnalysis.job.js';

/**
 * @param {object} options
 * @param {import('ioredis').default} options.connection
 * @param {string} options.queueName
 * @param {import('../../modules/analysis/services/AnalysisService.js').default} options.analysisService
 * @param {(payload: import('./analysis-complete.queue.js').AnalysisCompleteJobPayload) => Promise<import('bullmq').Job>} options.enqueueAnalysisComplete
 * @param {number} [options.concurrency]
 */
export function createAnalysisWorker({
  connection,
  queueName,
  analysisService,
  enqueueAnalysisComplete,
  concurrency,
}) {
  const worker = new Worker(
    queueName,
    async (job) => {
      if (job.name !== AI_ANALYZE_JOB_NAMES.ANALYZE) {
        console.warn(`[ai-analysis-worker] Unknown job name: ${job.name}`);
        return;
      }

      return processRunAnalysisJob(job.data, {
        analysisService,
        enqueueAnalysisComplete,
        job,
      });
    },
    {
      connection,
      concurrency: concurrency ?? Number(process.env.AI_ANALYSIS_WORKER_CONCURRENCY ?? 2),
    },
  );

  worker.on('completed', (job) => {
    console.log(`[ai-analysis-worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    console.error(`[ai-analysis-worker] Job ${job?.id} failed:`, error?.message ?? error);
  });

  return worker;
}
