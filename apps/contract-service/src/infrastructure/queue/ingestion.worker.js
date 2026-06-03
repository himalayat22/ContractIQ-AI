import { Worker } from 'bullmq';
import { INGESTION_JOB_NAMES } from './queues.js';
import { processExtractTextJob } from '../../modules/ingestion/jobs/extractText.job.js';

/**
 * @param {object} options
 * @param {import('ioredis').default} options.connection
 * @param {string} options.queueName
 * @param {import('../../modules/contracts/repositories/ContractRepository.js').default} options.contractRepository
 * @param {import('../../modules/ingestion/services/TextExtractionService.js').TextExtractionService} options.textExtractionService
 * @param {(payload: import('./ai-analyze.queue.js').AiAnalyzeJobPayload) => Promise<import('bullmq').Job>} options.enqueueAiAnalyze
 * @param {number} [options.concurrency]
 */
export function createIngestionWorker({
  connection,
  queueName,
  contractRepository,
  textExtractionService,
  enqueueAiAnalyze,
  concurrency,
}) {
  const worker = new Worker(
    queueName,
    async (job) => {
      if (job.name !== INGESTION_JOB_NAMES.EXTRACT) {
        console.warn(`[ingestion-worker] Unknown job name: ${job.name}`);
        return;
      }

      return processExtractTextJob(job.data, {
        contractRepository,
        textExtractionService,
        enqueueAiAnalyze,
      });
    },
    {
      connection,
      concurrency: concurrency ?? Number(process.env.CONTRACT_INGESTION_WORKER_CONCURRENCY ?? 2),
    },
  );

  worker.on('completed', (job) => {
    console.log(`[ingestion-worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    console.error(`[ingestion-worker] Job ${job?.id} failed:`, error?.message ?? error);
  });

  return worker;
}
