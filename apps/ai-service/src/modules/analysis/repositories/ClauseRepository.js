import { Clause } from '../models/Clause.js';

export class ClauseRepository {
  async deleteByContract(contractId) {
    await Clause.deleteMany({ contractId });
  }

  async insertMany(clauses) {
    if (!clauses.length) return [];
    return Clause.insertMany(clauses);
  }

  async listByContract(contractId, { clauseType, riskLevel, page, limit, sort }) {
    const filter = { contractId };
    if (clauseType) filter.clauseType = clauseType;
    if (riskLevel) filter.riskLevel = riskLevel;

    const sortField = sort === 'orderIndex' ? { orderIndex: 1 } : { orderIndex: 1 };
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Clause.find(filter).sort(sortField).skip(skip).limit(limit).lean(),
      Clause.countDocuments(filter),
    ]);

    return {
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async findById(contractId, clauseId) {
    return Clause.findOne({ contractId, _id: clauseId }).lean();
  }
}

export default new ClauseRepository();
