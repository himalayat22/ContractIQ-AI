import { Router } from 'express';
import authRoutes from '../modules/auth/routes/authRoutes.js';
import healthRoutes from './health.routes.js';

const apiRouter = Router();

apiRouter.use(healthRoutes);
apiRouter.use('/auth', authRoutes);

export default apiRouter;
