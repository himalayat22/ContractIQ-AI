import { createQueue } from './queueFactory.js';
import { ANALYSIS_COMPLETE_JOB_NAMES } from './queues.js';

export { createQueue as createAnalysisCompleteQueue };

/**
 * @typedef {object} AnalysisCompleteJobPayload
 * @property {string} tenantId
 * @property {string} contractId
 * @property {string} versionId
 * @property {string} [analysisId]
 * @property {'completed' | 'failed'} status
 * @property {number} [riskScore]
 * @property {'low' | 'medium' | 'high'} [riskLevel]
 * @property {Array<{ label: string, date: string | Date }>} [keyDates]
 * @property {string} [summary]
 * @property {string} [errorMessage]
 * @property {string} userId
 * @property {string} [correlationId]
 */

/**
 * @param {import('bullmq').Queue} queue
 * @param {AnalysisCompleteJobPayload} payload
 */
export async function enqueueAnalysisComplete(queue, payload) {
  const jobId = `complete-${payload.versionId}-${payload.status}`;
  return queue.add(ANALYSIS_COMPLETE_JOB_NAMES.COMPLETE, payload, { jobId });
}
