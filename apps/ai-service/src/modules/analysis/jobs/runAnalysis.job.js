/**
 * BullMQ job processor for `ai.analyze`.
 * @typedef {object} RunAnalysisJobPayload
 * @property {string} tenantId
 * @property {string} contractId
 * @property {string} versionId
 * @property {string} extractedText
 * @property {string} userId
 * @property {string} [correlationId]
 */

/**
 * @param {RunAnalysisJobPayload} data
 * @param {object} deps
 * @param {import('../services/AnalysisService.js').default} deps.analysisService
 * @param {(payload: import('../../../infrastructure/queue/analysis-complete.queue.js').AnalysisCompleteJobPayload) => Promise<import('bullmq').Job>} deps.enqueueAnalysisComplete
 * @param {import('bullmq').Job} deps.job
 */
export async function processRunAnalysisJob(data, deps) {
  const { analysisService, enqueueAnalysisComplete, job } = deps;

  try {
    const result = await analysisService.runAnalysis({
      tenantId: data.tenantId,
      contractId: data.contractId,
      versionId: data.versionId,
      contractText: data.extractedText,
      correlationId: data.correlationId,
    });

    const analysis = await analysisService.getAnalysis(data.tenantId, data.contractId);

    return enqueueAnalysisComplete({
      tenantId: data.tenantId,
      contractId: data.contractId,
      versionId: data.versionId,
      analysisId: result.analysisId,
      status: 'completed',
      riskScore: analysis.riskScore ?? undefined,
      riskLevel: analysis.riskLevel ?? undefined,
      keyDates: analysis.keyDates ?? [],
      summary: analysis.summary ?? undefined,
      userId: data.userId,
      correlationId: data.correlationId,
    });
  } catch (error) {
    const maxAttempts = job.opts.attempts ?? 1;
    const isLastAttempt = job.attemptsMade >= maxAttempts;

    if (isLastAttempt) {
      await enqueueAnalysisComplete({
        tenantId: data.tenantId,
        contractId: data.contractId,
        versionId: data.versionId,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Analysis failed',
        userId: data.userId,
        correlationId: data.correlationId,
      });
    }

    throw error;
  }
}
