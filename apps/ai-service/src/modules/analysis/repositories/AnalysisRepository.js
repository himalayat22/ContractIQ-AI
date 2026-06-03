import mongoose from 'mongoose';
import { Analysis } from '../models/Analysis.js';

function toObjectId(value) {
  return value instanceof mongoose.Types.ObjectId ? value : new mongoose.Types.ObjectId(value);
}

export class AnalysisRepository {
  async findByContract(tenantId, contractId) {
    return Analysis.findOne({
      tenantId: toObjectId(tenantId),
      contractId: toObjectId(contractId),
    }).lean();
  }

  async createProcessing({ tenantId, contractId, versionId, correlationId }) {
    const now = new Date();
    const estimatedCompletionAt = new Date(now.getTime() + 3 * 60 * 1000);

    return Analysis.create({
      tenantId,
      contractId,
      versionId,
      status: 'processing',
      progress: 10,
      stage: 'extracting_text',
      correlationId,
      startedAt: now,
      estimatedCompletionAt,
    });
  }

  async upsertProcessing({ tenantId, contractId, versionId, correlationId }) {
    const existing = await Analysis.findOne({ tenantId, contractId });

    if (existing) {
      existing.versionId = versionId;
      existing.status = 'processing';
      existing.progress = 10;
      existing.stage = 'extracting_text';
      existing.correlationId = correlationId;
      existing.startedAt = new Date();
      existing.estimatedCompletionAt = new Date(Date.now() + 3 * 60 * 1000);
      existing.completedAt = undefined;
      existing.errorMessage = undefined;
      await existing.save();
      return existing.toObject();
    }

    return this.createProcessing({ tenantId, contractId, versionId, correlationId });
  }

  async markCompleted(analysisId, payload) {
    return Analysis.findByIdAndUpdate(
      analysisId,
      {
        ...payload,
        status: 'completed',
        progress: 100,
        stage: 'completed',
        completedAt: new Date(),
      },
      { new: true, lean: true },
    );
  }

  async markFailed(analysisId, errorMessage) {
    return Analysis.findByIdAndUpdate(
      analysisId,
      {
        status: 'failed',
        progress: 0,
        stage: 'failed',
        errorMessage,
        completedAt: new Date(),
      },
      { new: true, lean: true },
    );
  }

  async updateProgress(analysisId, { progress, stage }) {
    return Analysis.findByIdAndUpdate(
      analysisId,
      { progress, stage },
      { new: true, lean: true },
    );
  }
}

export default new AnalysisRepository();
