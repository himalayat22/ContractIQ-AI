import mongoose from 'mongoose';

const riskFactorSchema = new mongoose.Schema(
  {
    factor: { type: String, required: true },
    weight: { type: Number, required: true },
    score: { type: Number, required: true },
    explanation: { type: String, required: true },
  },
  { _id: false },
);

const keyDateSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    date: { type: Date, required: true },
    sourceClauseId: { type: mongoose.Schema.Types.ObjectId },
  },
  { _id: false },
);

const keyObligationSchema = new mongoose.Schema(
  {
    party: { type: String, required: true },
    obligation: { type: String, required: true },
    dueDate: { type: Date },
    severity: { type: String, enum: ['low', 'medium', 'high'], required: true },
    clauseType: { type: String },
    sourceClauseId: { type: mongoose.Schema.Types.ObjectId },
  },
  { _id: false },
);

const analysisSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    contractId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    versionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    status: {
      type: String,
      enum: ['processing', 'completed', 'failed'],
      default: 'processing',
      index: true,
    },
    progress: { type: Number, default: 0 },
    stage: { type: String, default: 'queued' },
    summary: { type: String },
    riskScore: { type: Number },
    riskLevel: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
    riskFactors: [riskFactorSchema],
    keyDates: [keyDateSchema],
    keyObligations: [keyObligationSchema],
    modelUsed: { type: String },
    tokensUsed: { type: Number, default: 0 },
    processingTimeMs: { type: Number },
    correlationId: { type: String },
    errorMessage: { type: String },
    startedAt: { type: Date },
    completedAt: { type: Date },
    estimatedCompletionAt: { type: Date },
  },
  { timestamps: true, collection: 'analyses' },
);

analysisSchema.index({ tenantId: 1, contractId: 1 }, { unique: true });

export const Analysis =
  mongoose.models.Analysis ?? mongoose.model('Analysis', analysisSchema);

export default Analysis;
