import mongoose from 'mongoose';
import { AppError } from '../../../utils/AppError.js';
import AnalysisRepository from '../repositories/AnalysisRepository.js';
import ClauseRepository from '../repositories/ClauseRepository.js';
import GeminiAnalysisProvider from '../providers/GeminiAnalysisProvider.js';

function toAnalysisDto(doc) {
  if (!doc) return null;

  return {
    id: doc._id.toString(),
    contractId: doc.contractId.toString(),
    versionId: doc.versionId.toString(),
    tenantId: doc.tenantId.toString(),
    status: doc.status,
    summary: doc.summary ?? null,
    riskScore: doc.riskScore ?? null,
    riskLevel: doc.riskLevel ?? null,
    riskFactors: doc.riskFactors ?? [],
    keyDates: (doc.keyDates ?? []).map((kd) => ({
      label: kd.label,
      date: kd.date,
      sourceClauseId: kd.sourceClauseId?.toString() ?? null,
    })),
    keyObligations: (doc.keyObligations ?? []).map((item) => ({
      party: item.party,
      obligation: item.obligation,
      dueDate: item.dueDate ?? null,
      severity: item.severity,
      clauseType: item.clauseType ?? null,
      sourceClauseId: item.sourceClauseId?.toString() ?? null,
    })),
    modelUsed: doc.modelUsed ?? null,
    tokensUsed: doc.tokensUsed ?? 0,
    processingTimeMs: doc.processingTimeMs ?? null,
    completedAt: doc.completedAt ?? null,
  };
}

function toClauseDto(doc) {
  return {
    id: doc._id.toString(),
    contractId: doc.contractId.toString(),
    clauseType: doc.clauseType,
    title: doc.title,
    text: doc.text,
    riskLevel: doc.riskLevel,
    riskNote: doc.riskNote ?? null,
    playbookDeviation: doc.playbookDeviation ?? false,
    playbookDeviationDetail: doc.playbookDeviationDetail ?? null,
    pageNumber: doc.pageNumber ?? null,
    orderIndex: doc.orderIndex,
    startOffset: doc.startOffset ?? null,
    endOffset: doc.endOffset ?? null,
  };
}

function toStatusDto(doc) {
  return {
    status: doc.status,
    progress: doc.progress ?? 0,
    stage: doc.stage ?? 'queued',
    startedAt: doc.startedAt ?? null,
    estimatedCompletionAt: doc.estimatedCompletionAt ?? null,
  };
}

export class AnalysisService {
  constructor({
    analysisRepository = AnalysisRepository,
    clauseRepository = ClauseRepository,
    analysisProvider,
  } = {}) {
    this.analysisRepository = analysisRepository;
    this.clauseRepository = clauseRepository;
    this.analysisProvider = analysisProvider ?? new GeminiAnalysisProvider();
  }

  async runAnalysis({ tenantId, contractId, versionId, correlationId, contractText }) {
    if (!mongoose.isValidObjectId(tenantId)) {
      throw new AppError('Invalid tenantId', { statusCode: 400, code: 'VALIDATION_ERROR' });
    }
    if (!mongoose.isValidObjectId(contractId)) {
      throw new AppError('Invalid contractId', { statusCode: 400, code: 'VALIDATION_ERROR' });
    }
    if (!mongoose.isValidObjectId(versionId)) {
      throw new AppError('Invalid versionId', { statusCode: 400, code: 'VALIDATION_ERROR' });
    }

    const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
    const contractObjectId = new mongoose.Types.ObjectId(contractId);
    const versionObjectId = new mongoose.Types.ObjectId(versionId);

    const analysisRecord = await this.analysisRepository.upsertProcessing({
      tenantId: tenantObjectId,
      contractId: contractObjectId,
      versionId: versionObjectId,
      correlationId,
    });

    const analysisId = analysisRecord._id;

    try {
      await this.analysisRepository.updateProgress(analysisId, {
        progress: 25,
        stage: 'calling_gemini',
      });

      const result = await this.analysisProvider.analyze({
        tenantId: tenantObjectId,
        contractId: contractObjectId,
        contractText,
      });

      await this.analysisRepository.updateProgress(analysisId, {
        progress: 75,
        stage: 'persisting_results',
      });

      await this.clauseRepository.deleteByContract(contractObjectId);

      const clausesToInsert = result.clauses.map((clause) => ({
        ...clause,
        tenantId: tenantObjectId,
        contractId: contractObjectId,
        analysisId,
      }));

      await this.clauseRepository.insertMany(clausesToInsert);

      const completed = await this.analysisRepository.markCompleted(analysisId, {
        summary: result.summary,
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
        riskFactors: result.riskFactors,
        keyDates: result.keyDates,
        keyObligations: result.keyObligations,
        modelUsed: result.modelUsed,
        tokensUsed: result.tokensUsed,
        processingTimeMs: result.processingTimeMs,
      });

      return {
        analysisId: analysisId.toString(),
        status: completed.status,
      };
    } catch (error) {
      await this.analysisRepository.markFailed(
        analysisId,
        error instanceof Error ? error.message : 'Analysis failed',
      );
      throw error;
    }
  }

  async getAnalysis(tenantId, contractId) {
    const analysis = await this.analysisRepository.findByContract(tenantId, contractId);

    if (!analysis) {
      throw new AppError('Analysis not found', { statusCode: 404, code: 'ANALYSIS_NOT_FOUND' });
    }

    return toAnalysisDto(analysis);
  }

  async getStatus(tenantId, contractId) {
    const analysis = await this.analysisRepository.findByContract(tenantId, contractId);

    if (!analysis) {
      throw new AppError('Analysis not found', { statusCode: 404, code: 'ANALYSIS_NOT_FOUND' });
    }

    return toStatusDto(analysis);
  }

  async listClauses(tenantId, contractId, query) {
    await this.assertAnalysisExists(tenantId, contractId);

    const result = await this.clauseRepository.listByContract(contractId, {
      clauseType: query.clauseType,
      riskLevel: query.riskLevel,
      page: query.page,
      limit: query.limit,
      sort: query.sort,
    });

    return {
      data: result.data.map(toClauseDto),
      pagination: result.pagination,
    };
  }

  async getClause(tenantId, contractId, clauseId) {
    await this.assertAnalysisExists(tenantId, contractId);

    const clause = await this.clauseRepository.findById(contractId, clauseId);

    if (!clause) {
      throw new AppError('Clause not found', { statusCode: 404, code: 'CLAUSE_NOT_FOUND' });
    }

    return toClauseDto(clause);
  }

  async getKeyObligations(tenantId, contractId) {
    const analysis = await this.analysisRepository.findByContract(tenantId, contractId);

    if (!analysis) {
      throw new AppError('Analysis not found', { statusCode: 404, code: 'ANALYSIS_NOT_FOUND' });
    }

    if (analysis.status !== 'completed') {
      throw new AppError('Analysis is not completed yet', {
        statusCode: 409,
        code: 'ANALYSIS_IN_PROGRESS',
      });
    }

    return {
      contractId: analysis.contractId.toString(),
      keyObligations: (analysis.keyObligations ?? []).map((item) => ({
        party: item.party,
        obligation: item.obligation,
        dueDate: item.dueDate ?? null,
        severity: item.severity,
        clauseType: item.clauseType ?? null,
        sourceClauseId: item.sourceClauseId?.toString() ?? null,
      })),
      detectedAt: analysis.completedAt ?? null,
      modelUsed: analysis.modelUsed ?? null,
    };
  }

  async assertAnalysisExists(tenantId, contractId) {
    const analysis = await this.analysisRepository.findByContract(tenantId, contractId);

    if (!analysis) {
      throw new AppError('Analysis not found', { statusCode: 404, code: 'ANALYSIS_NOT_FOUND' });
    }

    return analysis;
  }
}

export default new AnalysisService();
