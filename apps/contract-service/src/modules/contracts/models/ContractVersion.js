import mongoose from 'mongoose';

const { Schema } = mongoose;

export const INGESTION_STATUSES = ['pending', 'completed', 'failed'];

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const contractVersionSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      required: [true, 'tenantId is required'],
      index: true,
    },
    contractId: {
      type: Schema.Types.ObjectId,
      ref: 'Contract',
      required: [true, 'contractId is required'],
    },
    versionNumber: {
      type: Number,
      required: [true, 'versionNumber is required'],
      min: 1,
    },
    fileName: {
      type: String,
      required: [true, 'fileName is required'],
      trim: true,
    },
    fileSize: {
      type: Number,
      required: [true, 'fileSize is required'],
      min: 1,
      max: 52_428_800,
    },
    mimeType: {
      type: String,
      required: [true, 'mimeType is required'],
      enum: {
        values: ALLOWED_MIME_TYPES,
        message: 'mimeType must be application/pdf or DOCX',
      },
    },
    storageKey: {
      type: String,
      required: [true, 'storageKey is required'],
    },
    checksum: {
      type: String,
      default: null,
      validate: {
        validator(value) {
          if (value == null || value === '') return true;
          return /^[a-fA-F0-9]{64}$/.test(value);
        },
        message: 'checksum must be a 64-character SHA-256 hex string',
      },
    },
    extractedText: {
      type: String,
      default: null,
    },
    extractedTextLength: {
      type: Number,
      default: null,
      min: 0,
    },
    pageCount: {
      type: Number,
      default: null,
      min: 1,
    },
    ingestionStatus: {
      type: String,
      required: true,
      enum: {
        values: INGESTION_STATUSES,
        message: `ingestionStatus must be one of: ${INGESTION_STATUSES.join(', ')}`,
      },
      default: 'pending',
    },
    ocrUsed: {
      type: Boolean,
      default: false,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      required: [true, 'uploadedBy is required'],
    },
    uploadedAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    schemaVersion: {
      type: Number,
      required: true,
      default: 1,
    },
  },
  {
    collection: 'contract_versions',
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

contractVersionSchema.index(
  { contractId: 1, versionNumber: 1 },
  { unique: true, name: 'idx_versions_contractId_versionNumber_unique' },
);
contractVersionSchema.index(
  { tenantId: 1, contractId: 1, uploadedAt: -1 },
  { name: 'idx_versions_tenantId_contractId' },
);
contractVersionSchema.index({ storageKey: 1 }, { unique: true, name: 'idx_versions_storageKey_unique' });

const ContractVersion =
  mongoose.models.ContractVersion ?? mongoose.model('ContractVersion', contractVersionSchema);

export default ContractVersion;
