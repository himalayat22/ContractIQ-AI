import mongoose from 'mongoose';

const { Schema } = mongoose;

export const CONTRACT_TYPES = ['nda', 'msa', 'sow', 'employment', 'vendor', 'other'];

export const CONTRACT_STATUSES = ['uploading', 'processing', 'analyzed', 'failed', 'deleted'];

export const RISK_LEVELS = ['low', 'medium', 'high'];

const keyDateSchema = new Schema(
  {
    label: {
      type: String,
      required: [true, 'Key date label is required'],
      trim: true,
      maxlength: 200,
    },
    date: {
      type: Date,
      required: [true, 'Key date is required'],
    },
    sourceClauseId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
  },
  { _id: false },
);

const contractSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      required: [true, 'tenantId is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: 1,
      maxlength: 500,
    },
    counterparty: {
      type: String,
      required: [true, 'Counterparty is required'],
      trim: true,
      minlength: 1,
      maxlength: 300,
    },
    contractType: {
      type: String,
      required: [true, 'contractType is required'],
      enum: {
        values: CONTRACT_TYPES,
        message: `contractType must be one of: ${CONTRACT_TYPES.join(', ')}`,
      },
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: CONTRACT_STATUSES,
        message: `status must be one of: ${CONTRACT_STATUSES.join(', ')}`,
      },
      default: 'uploading',
    },
    currentVersionId: {
      type: Schema.Types.ObjectId,
      ref: 'ContractVersion',
      default: null,
    },
    currentAnalysisId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    riskScore: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
      validate: {
        validator(value) {
          if (value == null) return true;
          return Number.isInteger(value);
        },
        message: 'riskScore must be an integer between 0 and 100',
      },
    },
    riskLevel: {
      type: String,
      default: null,
      validate: {
        validator(value) {
          return value == null || RISK_LEVELS.includes(value);
        },
        message: `riskLevel must be one of: ${RISK_LEVELS.join(', ')}`,
      },
    },
    keyDates: {
      type: [keyDateSchema],
      default: [],
    },
    effectiveDate: {
      type: Date,
      default: null,
    },
    expirationDate: {
      type: Date,
      default: null,
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator(value) {
          if (!Array.isArray(value) || value.length > 20) return false;
          return value.every((tag) => typeof tag === 'string' && tag.length >= 1 && tag.length <= 50);
        },
        message: 'tags must have at most 20 items; each tag 1–50 characters',
      },
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      required: [true, 'createdBy is required'],
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    schemaVersion: {
      type: Number,
      required: true,
      default: 1,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'contracts',
    timestamps: true,
    versionKey: false,
  },
);

contractSchema.pre('validate', function normalizeTags(next) {
  if (Array.isArray(this.tags)) {
    this.tags = this.tags
      .map((tag) => String(tag).trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 20);
  }
  next();
});

contractSchema.index({ tenantId: 1, _id: 1 }, { name: 'idx_contracts_tenantId_id' });
contractSchema.index({ tenantId: 1, status: 1, createdAt: -1 }, { name: 'idx_contracts_tenantId_status' });
contractSchema.index({ tenantId: 1, riskLevel: 1, updatedAt: -1 }, { name: 'idx_contracts_tenantId_riskLevel' });
contractSchema.index({ tenantId: 1, contractType: 1 }, { name: 'idx_contracts_tenantId_contractType' });
contractSchema.index({ tenantId: 1, createdBy: 1 }, { name: 'idx_contracts_tenantId_createdBy' });
contractSchema.index({ tenantId: 1, createdAt: -1 }, { name: 'idx_contracts_tenantId_createdAt' });
contractSchema.index({ tenantId: 1, updatedAt: -1 }, { name: 'idx_contracts_tenantId_updatedAt' });
contractSchema.index(
  { tenantId: 1, deletedAt: 1 },
  { name: 'idx_contracts_tenantId_deletedAt', partialFilterExpression: { deletedAt: null } },
);
contractSchema.index(
  { title: 'text', counterparty: 'text', tags: 'text' },
  { name: 'idx_contracts_tenantId_text' },
);

contractSchema.methods.isDeleted = function isDeleted() {
  return this.deletedAt != null || this.status === 'deleted';
};

contractSchema.methods.isActive = function isActive() {
  return this.deletedAt == null && this.status !== 'deleted';
};

const Contract = mongoose.models.Contract ?? mongoose.model('Contract', contractSchema);

export default Contract;
