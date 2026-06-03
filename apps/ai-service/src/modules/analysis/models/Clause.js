import mongoose from 'mongoose';

const clauseSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    contractId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    analysisId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    clauseType: { type: String, required: true, index: true },
    title: { type: String, required: true },
    text: { type: String, required: true },
    riskLevel: { type: String, enum: ['low', 'medium', 'high'], required: true },
    riskNote: { type: String },
    playbookDeviation: { type: Boolean, default: false },
    playbookDeviationDetail: { type: String },
    pageNumber: { type: Number },
    orderIndex: { type: Number, required: true },
    startOffset: { type: Number },
    endOffset: { type: Number },
  },
  { timestamps: true, collection: 'clauses' },
);

clauseSchema.index({ contractId: 1, orderIndex: 1 });

export const Clause = mongoose.models.Clause ?? mongoose.model('Clause', clauseSchema);

export default Clause;
