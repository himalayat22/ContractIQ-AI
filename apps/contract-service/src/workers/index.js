import { createRedisConnection, getSharedRedisConnection } from '../infrastructure/redis/connection.js';
import {
  createIngestionQueue,
  enqueueIngestionExtract,
} from '../infrastructure/queue/ingestion.queue.js';
import { createAiAnalyzeQueue, enqueueAiAnalyze } from '../infrastructure/queue/ai-analyze.queue.js';
import { createAnalysisCompleteQueue } from '../infrastructure/queue/analysis-complete.queue.js';
import { createIngestionWorker } from '../infrastructure/queue/ingestion.worker.js';
import { createAnalysisCompleteWorker } from '../infrastructure/queue/analysis-complete.worker.js';
import NotificationClient from '../infrastructure/clients/NotificationClient.js';
import ContractRepository from '../modules/contracts/repositories/ContractRepository.js';
import { ContractService } from '../modules/contracts/services/ContractService.js';
import TextExtractionService from '../modules/ingestion/services/TextExtractionService.js';

/**
 * Wire Redis, BullMQ queues/workers, and contract upload orchestration.
 * @param {import('../config/env.js').ReturnType<import('../config/env.js').getConfig>} config
 */
export function createContractRuntime(config) {
  const queueConnection = getSharedRedisConnection(config.redisUrl);
  const ingestionWorkerConnection = createRedisConnection(config.redisUrl);
  const analysisCompleteWorkerConnection = createRedisConnection(config.redisUrl);

  const ingestionQueue = createIngestionQueue(queueConnection, config.ingestionQueueName);
  const aiAnalyzeQueue = createAiAnalyzeQueue(queueConnection, config.aiAnalyzeQueueName);
  const analysisCompleteQueue = createAnalysisCompleteQueue(
    queueConnection,
    config.analysisCompleteQueueName,
  );

  const contractRepository = new ContractRepository();
  const textExtractionService = new TextExtractionService();
  const notificationClient = new NotificationClient({
    baseUrl: config.notificationServiceUrl,
    internalApiKey: config.internalApiKey,
  });

  const enqueueAiAnalyzeJob = (payload) => enqueueAiAnalyze(aiAnalyzeQueue, payload);

  const ingestionWorker = config.runWorker
    ? createIngestionWorker({
        connection: ingestionWorkerConnection,
        queueName: config.ingestionQueueName,
        contractRepository,
        textExtractionService,
        enqueueAiAnalyze: enqueueAiAnalyzeJob,
      })
    : null;

  const analysisCompleteWorker = config.runWorker
    ? createAnalysisCompleteWorker({
        connection: analysisCompleteWorkerConnection,
        queueName: config.analysisCompleteQueueName,
        contractRepository,
        notificationClient,
      })
    : null;

  const contractService = new ContractService({
    contractRepository,
    enqueueIngestionExtract: (payload) => enqueueIngestionExtract(ingestionQueue, payload),
  });

  return {
    ingestionQueue,
    aiAnalyzeQueue,
    analysisCompleteQueue,
    ingestionWorker,
    analysisCompleteWorker,
    queueConnection,
    ingestionWorkerConnection,
    analysisCompleteWorkerConnection,
    contractService,
    async close() {
      if (ingestionWorker) {
        await ingestionWorker.close();
      }
      if (analysisCompleteWorker) {
        await analysisCompleteWorker.close();
      }
      await ingestionQueue.close();
      await aiAnalyzeQueue.close();
      await analysisCompleteQueue.close();
      await ingestionWorkerConnection.quit();
      await analysisCompleteWorkerConnection.quit();
      await queueConnection.quit();
    },
  };
}
