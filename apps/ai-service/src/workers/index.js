import { createRedisConnection, getSharedRedisConnection } from '../infrastructure/redis/connection.js';
import { createAiAnalyzeQueue } from '../infrastructure/queue/analysis.queue.js';
import {
  createAnalysisCompleteQueue,
  enqueueAnalysisComplete,
} from '../infrastructure/queue/analysis-complete.queue.js';
import { createAnalysisWorker } from '../infrastructure/queue/analysis.worker.js';
import AnalysisService from '../modules/analysis/services/AnalysisService.js';

/**
 * Wire Redis, BullMQ analysis worker, and analysis-complete producer.
 * @param {import('../config/env.js').ReturnType<import('../config/env.js').getConfig>} config
 */
export function createAiRuntime(config) {
  const queueConnection = getSharedRedisConnection(config.redisUrl);
  const workerConnection = createRedisConnection(config.redisUrl);

  const aiAnalyzeQueue = createAiAnalyzeQueue(queueConnection, config.aiAnalyzeQueueName);
  const analysisCompleteQueue = createAnalysisCompleteQueue(
    queueConnection,
    config.analysisCompleteQueueName,
  );

  const enqueueAnalysisCompleteJob = (payload) =>
    enqueueAnalysisComplete(analysisCompleteQueue, payload);

  const analysisWorker = config.runWorker
    ? createAnalysisWorker({
        connection: workerConnection,
        queueName: config.aiAnalyzeQueueName,
        analysisService: AnalysisService,
        enqueueAnalysisComplete: enqueueAnalysisCompleteJob,
      })
    : null;

  return {
    aiAnalyzeQueue,
    analysisCompleteQueue,
    analysisWorker,
    queueConnection,
    workerConnection,
    async close() {
      if (analysisWorker) {
        await analysisWorker.close();
      }
      await aiAnalyzeQueue.close();
      await analysisCompleteQueue.close();
      if (workerConnection !== queueConnection) {
        await workerConnection.quit();
      }
      await queueConnection.quit();
    },
  };
}
