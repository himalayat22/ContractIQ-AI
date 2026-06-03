import AnalysisService from '../services/AnalysisService.js';

function buildMeta(req) {
  return {
    requestId: req.headers['x-request-id'] ?? req.id ?? null,
    timestamp: new Date().toISOString(),
  };
}

export class InternalAnalysisController {
  constructor(analysisService = AnalysisService) {
    this.analysisService = analysisService;
  }

  runAnalysis = async (req, res, next) => {
    try {
      const { tenantId, contractId, versionId, correlationId, contractText } = req.body;

      const result = await this.analysisService.runAnalysis({
        tenantId,
        contractId,
        versionId,
        contractText,
        correlationId: correlationId ?? req.headers['x-request-id'] ?? req.id,
      });

      return res.status(202).json({
        success: true,
        data: result,
        meta: buildMeta(req),
      });
    } catch (error) {
      return next(error);
    }
  };
}

export default new InternalAnalysisController();
