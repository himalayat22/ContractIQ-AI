import { Router } from 'express';
import internalAnalysisController from '../controllers/InternalAnalysisController.js';
import { authenticateInternal } from '../../../middleware/authenticateInternal.js';
import { validateBody } from '../../../middleware/validateRequest.js';
import { runAnalysisBodySchema } from '../validations/analysis.validation.js';

const internalRoutes = Router();

internalRoutes.post(
  '/analysis/run',
  authenticateInternal,
  validateBody(runAnalysisBodySchema),
  internalAnalysisController.runAnalysis,
);

export default internalRoutes;
