import { Router } from 'express';
import healthRoutes from './health.routes.js';
import { createContractRoutes } from '../modules/contracts/routes/contractRoutes.js';

/**
 * @param {{ contractService?: import('../modules/contracts/services/ContractService.js').ContractService }} deps
 */
export function createApiRouter({ contractService } = {}) {
  const apiRouter = Router();

  apiRouter.use(healthRoutes);
  apiRouter.use(createContractRoutes({ contractService }));

  return apiRouter;
}

export default createApiRouter;
