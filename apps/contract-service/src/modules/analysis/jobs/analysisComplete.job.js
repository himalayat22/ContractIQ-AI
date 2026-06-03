/**
 * BullMQ job processor for `analysis.complete`.
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
 * @param {AnalysisCompleteJobPayload} data
 * @param {object} deps
 * @param {import('../../contracts/repositories/ContractRepository.js').default} deps.contractRepository
 * @param {import('../../../infrastructure/clients/NotificationClient.js').NotificationClient} deps.notificationClient
 */
export async function processAnalysisCompleteJob(data, deps) {
  const { contractRepository, notificationClient } = deps;

  if (data.status === 'completed') {
    await contractRepository.updateContractAfterAnalysis(data.contractId, {
      status: 'analyzed',
      riskScore: data.riskScore ?? null,
      riskLevel: data.riskLevel ?? null,
      keyDates: data.keyDates ?? [],
      currentAnalysisId: data.analysisId ?? null,
    });

    await notificationClient.sendAnalysisNotification({
      tenantId: data.tenantId,
      userId: data.userId,
      contractId: data.contractId,
      type: 'analysis_complete',
      title: 'Contract analysis complete',
      body: data.summary
        ? `Analysis finished for your contract. ${data.summary.slice(0, 200)}${data.summary.length > 200 ? '…' : ''}`
        : 'Your contract has been analyzed and is ready to review.',
      correlationId: data.correlationId,
      metadata: {
        riskScore: data.riskScore ?? null,
        riskLevel: data.riskLevel ?? null,
        analysisId: data.analysisId ?? null,
      },
    });

    return { contractId: data.contractId, status: 'analyzed' };
  }

  await contractRepository.updateContractStatus(data.contractId, 'failed');

  await notificationClient.sendAnalysisNotification({
    tenantId: data.tenantId,
    userId: data.userId,
    contractId: data.contractId,
    type: 'analysis_failed',
    title: 'Contract analysis failed',
    body: data.errorMessage ?? 'We could not complete analysis for your contract. Please try again.',
    correlationId: data.correlationId,
    metadata: {
      analysisId: data.analysisId ?? null,
      versionId: data.versionId,
    },
  });

  return { contractId: data.contractId, status: 'failed' };
}
