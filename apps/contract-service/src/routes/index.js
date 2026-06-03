import { Router } from 'express';
import healthRoutes from './health.routes.js';
import contractRoutes from '../modules/contracts/routes/contractRoutes.js';

const apiRouter = Router();

apiRouter.use(healthRoutes);
apiRouter.use(contractRoutes);

export default apiRouter;
