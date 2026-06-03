import { createQueue } from './queueFactory.js';
import { AI_ANALYZE_JOB_NAMES } from './queues.js';

export { createQueue as createAiAnalyzeQueue };

/**
 * @typedef {object} AiAnalyzeJobPayload
 * @property {string} tenantId
 * @property {string} contractId
 * @property {string} versionId
 * @property {string} extractedText
 * @property {string} userId
 * @property {string} [correlationId]
 */

/**
 * @param {import('bullmq').Queue} queue
 * @param {AiAnalyzeJobPayload} payload
 */
export async function enqueueAiAnalyze(queue, payload) {
  const jobId = `analyze-${payload.versionId}`;
  return queue.add(AI_ANALYZE_JOB_NAMES.ANALYZE, payload, { jobId });
}
