import Contract from '../models/Contract.js';
import ContractVersion from '../models/ContractVersion.js';

const versionSelect = 'fileName fileSize mimeType versionNumber uploadedAt storageKey';

export class ContractRepository {
  create(payload) {
    return Contract.create(payload);
  }

  createVersion(payload) {
    return ContractVersion.create(payload);
  }

  setCurrentVersion(contractId, versionId) {
    return Contract.findByIdAndUpdate(contractId, { $set: { currentVersionId: versionId } }, { new: true });
  }

  findVersionById(id) {
    return ContractVersion.findById(id);
  }

  async list({ page, limit, status, contractType, q, tenantId }) {
    const filter = { deletedAt: null };

    if (tenantId) filter.tenantId = tenantId;
    if (status) filter.status = status;
    if (contractType) filter.contractType = contractType;
    if (q) filter.$text = { $search: q };

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Contract.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: 'currentVersionId', select: versionSelect }),
      Contract.countDocuments(filter),
    ]);

    return { items, total };
  }

  findById(id) {
    return Contract.findOne({ _id: id, deletedAt: null }).populate({
      path: 'currentVersionId',
      select: versionSelect,
    });
  }

  softDeleteById(id) {
    return Contract.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { status: 'deleted', deletedAt: new Date() } },
      { new: true },
    ).populate({ path: 'currentVersionId', select: versionSelect });
  }
}

export default ContractRepository;
