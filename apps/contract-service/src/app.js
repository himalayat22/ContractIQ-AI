import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createApiRouter } from './routes/index.js';
import { correlationId } from './middleware/correlationId.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { errorHandler } from './middleware/errorHandler.js';

/**
 * @param {{ contractService?: import('./modules/contracts/services/ContractService.js').ContractService }} deps
 */
export function createApp({ contractService } = {}) {
  const app = express();

  app.set('trust proxy', 1);
  app.use(correlationId);
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.WEB_URL ?? true,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use('/api/v1', createApiRouter({ contractService }));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
