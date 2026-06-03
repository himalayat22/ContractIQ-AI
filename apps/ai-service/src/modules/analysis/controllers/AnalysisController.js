import AnalysisService from '../services/AnalysisService.js';

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

export class AnalysisController {
  constructor(analysisService = AnalysisService) {
    this.analysisService = analysisService;
  }

  getAnalysis = async (req, res, next) => {
    try {
      const data = await this.analysisService.getAnalysis(req.tenantId, req.params.contractId);
      return sendSuccess(res, 200, data, req);
    } catch (error) {
      return next(error);
    }
  };

  getStatus = async (req, res, next) => {
    try {
      const data = await this.analysisService.getStatus(req.tenantId, req.params.contractId);
      return sendSuccess(res, 200, data, req);
    } catch (error) {
      return next(error);
    }
  };

  listClauses = async (req, res, next) => {
    try {
      const result = await this.analysisService.listClauses(
        req.tenantId,
        req.params.contractId,
        req.validatedQuery,
      );
      return sendSuccess(res, 200, result.data, req, result.pagination);
    } catch (error) {
      return next(error);
    }
  };

  getClause = async (req, res, next) => {
    try {
      const data = await this.analysisService.getClause(
        req.tenantId,
        req.params.contractId,
        req.params.clauseId,
      );
      return sendSuccess(res, 200, data, req);
    } catch (error) {
      return next(error);
    }
  };

  getKeyObligations = async (req, res, next) => {
    try {
      const data = await this.analysisService.getKeyObligations(
        req.tenantId,
        req.params.contractId,
      );
      return sendSuccess(res, 200, data, req);
    } catch (error) {
      return next(error);
    }
  };
}

export default new AnalysisController();
