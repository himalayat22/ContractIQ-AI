import { Router } from 'express';
import healthRoutes from './health.routes.js';
import analysisRoutes from '../modules/analysis/routes/analysisRoutes.js';
import internalRoutes from '../modules/analysis/routes/internalRoutes.js';

const apiRouter = Router();

apiRouter.use(healthRoutes);
apiRouter.use('/analysis', analysisRoutes);
apiRouter.use('/internal', internalRoutes);

export default apiRouter;
