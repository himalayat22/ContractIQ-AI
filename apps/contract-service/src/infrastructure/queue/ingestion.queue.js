import { createQueue } from './queueFactory.js';
import { INGESTION_JOB_NAMES } from './queues.js';

export { createQueue as createIngestionQueue };

/**
 * @typedef {object} IngestionExtractJobPayload
 * @property {string} tenantId
 * @property {string} contractId
 * @property {string} versionId
 * @property {string} storageKey
 * @property {string} userId
 * @property {string} [correlationId]
 */

/**
 * @param {import('bullmq').Queue} queue
 * @param {IngestionExtractJobPayload} payload
 */
export async function enqueueIngestionExtract(queue, payload) {
  const jobId = `ingest-${payload.versionId}`;
  return queue.add(INGESTION_JOB_NAMES.EXTRACT, payload, { jobId });
}
