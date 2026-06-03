import fs from 'fs/promises';
import mongoose from 'mongoose';
import { AppError } from '../../../utils/AppError.js';
import { createContractSchema } from '../validations/contract.validation.js';
import ContractRepository from '../repositories/ContractRepository.js';

function versionFileFields(version) {
  if (!version) {
    return {
      fileName: null,
      fileSize: null,
      mimeType: null,
      versionNumber: null,
    };
  }

  return {
    fileName: version.fileName,
    fileSize: version.fileSize,
    mimeType: version.mimeType,
    versionNumber: version.versionNumber,
  };
}

function toContractSummary(contract) {
  const version =
    contract.currentVersionId && typeof contract.currentVersionId === 'object'
      ? contract.currentVersionId
      : null;

  return {
    id: contract._id.toString(),
    tenantId: contract.tenantId.toString(),
    title: contract.title,
    counterparty: contract.counterparty,
    contractType: contract.contractType,
    status: contract.status,
    riskScore: contract.riskScore,
    riskLevel: contract.riskLevel,
    keyDates: contract.keyDates,
    currentVersionId: version?._id?.toString() ?? contract.currentVersionId?.toString() ?? null,
    ...versionFileFields(version),
    effectiveDate: contract.effectiveDate,
    expirationDate: contract.expirationDate,
    tags: contract.tags,
    createdBy: contract.createdBy.toString(),
    createdAt: contract.createdAt,
    updatedAt: contract.updatedAt,
  };
}

export class ContractService {
  constructor({ contractRepository = new ContractRepository(), enqueueIngestionExtract } = {}) {
    this.contractRepository = contractRepository;
    this.enqueueIngestionExtract = enqueueIngestionExtract;
  }

  async uploadContract(metadata, file) {
    if (!file) {
      throw new AppError('PDF file is required', { statusCode: 400, code: 'VALIDATION_ERROR' });
    }

    const normalized = {
      ...metadata,
      tags: Array.isArray(metadata.tags)
        ? metadata.tags
        : typeof metadata.tags === 'string' && metadata.tags.length
          ? metadata.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
          : [],
    };

    const parsed = createContractSchema.safeParse(normalized);
    if (!parsed.success) {
      throw new AppError('Validation failed', {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        details: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          messages: [issue.message],
        })),
      });
    }

    const payload = parsed.data;
    const tenantId = new mongoose.Types.ObjectId(payload.tenantId);
    const createdBy = new mongoose.Types.ObjectId(payload.createdBy);

    const contract = await this.contractRepository.create({
      tenantId,
      title: payload.title,
      counterparty: payload.counterparty,
      contractType: payload.contractType,
      effectiveDate: payload.effectiveDate ? new Date(payload.effectiveDate) : null,
      expirationDate: payload.expirationDate ? new Date(payload.expirationDate) : null,
      tags: payload.tags,
      createdBy,
      status: 'uploading',
    });

    const version = await this.contractRepository.createVersion({
      tenantId,
      contractId: contract._id,
      versionNumber: 1,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      storageKey: file.path,
      uploadedBy: createdBy,
    });

    const updated = await this.contractRepository.setCurrentVersion(contract._id, version._id);
    updated.currentVersionId = version;

    await this.contractRepository.updateContractStatus(contract._id, 'processing');

    if (this.enqueueIngestionExtract) {
      await this.enqueueIngestionExtract({
        tenantId: tenantId.toString(),
        contractId: contract._id.toString(),
        versionId: version._id.toString(),
        storageKey: file.path,
        userId: createdBy.toString(),
        correlationId: `upload-${version._id.toString()}`,
      });
    }

    const summary = toContractSummary(updated);
    summary.status = 'processing';
    return summary;
  }

  async listContracts(query) {
    const { items, total } = await this.contractRepository.list(query);
    return {
      data: items.map(toContractSummary),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  }

  async getContractById(id) {
    const contract = await this.contractRepository.findById(id);
    if (!contract) {
      throw new AppError('Contract not found', { statusCode: 404, code: 'CONTRACT_NOT_FOUND' });
    }
    return toContractSummary(contract);
  }

  async deleteContract(id) {
    const contract = await this.contractRepository.softDeleteById(id);
    if (!contract) {
      throw new AppError('Contract not found', { statusCode: 404, code: 'CONTRACT_NOT_FOUND' });
    }

    const version = contract.currentVersionId;
    const filePath = version && typeof version === 'object' ? version.storageKey : null;
    if (filePath) {
      await fs.unlink(filePath).catch(() => {});
    }
  }
}

export default ContractService;
