import ContractService from '../services/ContractService.js';

function buildMeta(req) {
  return {
    requestId: req.headers['x-request-id'] ?? req.id ?? null,
    timestamp: new Date().toISOString(),
  };
}

function sendSuccess(res, statusCode, data, req, pagination) {
  return res.status(statusCode).json({
    success: true,
    data,
    ...(pagination ? { pagination } : {}),
    meta: buildMeta(req),
  });
}

export class ContractController {
  constructor(contractService) {
    this.contractService = contractService ?? new ContractService();
  }

  upload = async (req, res, next) => {
    try {
      const data = await this.contractService.uploadContract(req.body, req.file);
      return sendSuccess(res, 201, data, req);
    } catch (error) {
      return next(error);
    }
  };

  list = async (req, res, next) => {
    try {
      const result = await this.contractService.listContracts(req.validatedQuery ?? req.query);
      return sendSuccess(res, 200, result.data, req, result.pagination);
    } catch (error) {
      return next(error);
    }
  };

  getById = async (req, res, next) => {
    try {
      const data = await this.contractService.getContractById(req.params.id);
      return sendSuccess(res, 200, data, req);
    } catch (error) {
      return next(error);
    }
  };

  delete = async (req, res, next) => {
    try {
      await this.contractService.deleteContract(req.params.id);
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  };
}

export default ContractController;
