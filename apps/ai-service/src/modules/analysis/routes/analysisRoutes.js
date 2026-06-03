import { Router } from 'express';
import analysisController from '../controllers/AnalysisController.js';
import { requireTenant } from '../../../middleware/requireTenant.js';
import { validateParams, validateQuery } from '../../../middleware/validateRequest.js';
import {
  clauseIdParamsSchema,
  contractIdParamsSchema,
  listClausesQuerySchema,
} from '../validations/analysis.validation.js';

const analysisRoutes = Router();

analysisRoutes.use(requireTenant);

analysisRoutes.get(
  '/contracts/:contractId',
  validateParams(contractIdParamsSchema),
  analysisController.getAnalysis,
);

analysisRoutes.get(
  '/contracts/:contractId/status',
  validateParams(contractIdParamsSchema),
  analysisController.getStatus,
);

analysisRoutes.get(
  '/contracts/:contractId/clauses',
  validateParams(contractIdParamsSchema),
  validateQuery(listClausesQuerySchema),
  analysisController.listClauses,
);

analysisRoutes.get(
  '/contracts/:contractId/clauses/:clauseId',
  validateParams(clauseIdParamsSchema),
  analysisController.getClause,
);

analysisRoutes.get(
  '/contracts/:contractId/key-obligations',
  validateParams(contractIdParamsSchema),
  analysisController.getKeyObligations,
);

export default analysisRoutes;
