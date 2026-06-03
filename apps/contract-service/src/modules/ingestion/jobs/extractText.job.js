/**
 * BullMQ job processor for `ingestion.extract`.
 * @typedef {import('../../../infrastructure/queue/ingestion.queue.js').IngestionExtractJobPayload} IngestionExtractJobPayload
 */

/**
 * @param {IngestionExtractJobPayload} data
 * @param {object} deps
 * @param {import('../../contracts/repositories/ContractRepository.js').default} deps.contractRepository
 * @param {import('../services/TextExtractionService.js').TextExtractionService} deps.textExtractionService
 * @param {(payload: import('../../../infrastructure/queue/ai-analyze.queue.js').AiAnalyzeJobPayload) => Promise<import('bullmq').Job>} deps.enqueueAiAnalyze
 */
export async function processExtractTextJob(data, deps) {
  const { contractRepository, textExtractionService, enqueueAiAnalyze } = deps;

  const version = await contractRepository.findVersionById(data.versionId);
  if (!version) {
    throw new Error(`Contract version not found: ${data.versionId}`);
  }

  if (version.ingestionStatus === 'completed' && version.extractedText) {
    return enqueueAiAnalyze({
      tenantId: data.tenantId,
      contractId: data.contractId,
      versionId: data.versionId,
      extractedText: version.extractedText,
      userId: data.userId,
      correlationId: data.correlationId,
    });
  }

  try {
    const extracted = await textExtractionService.extractFromFile(
      version.storageKey,
      version.mimeType,
    );

    await contractRepository.updateVersionIngestion(data.versionId, {
      extractedText: extracted.extractedText,
      extractedTextLength: extracted.extractedTextLength,
      pageCount: extracted.pageCount,
      ingestionStatus: 'completed',
      ocrUsed: extracted.ocrUsed,
    });

    return enqueueAiAnalyze({
      tenantId: data.tenantId,
      contractId: data.contractId,
      versionId: data.versionId,
      extractedText: extracted.extractedText,
      userId: data.userId,
      correlationId: data.correlationId,
    });
  } catch (error) {
    await contractRepository.updateVersionIngestion(data.versionId, {
      ingestionStatus: 'failed',
    });
    await contractRepository.updateContractStatus(data.contractId, 'failed');
    throw error;
  }
}
