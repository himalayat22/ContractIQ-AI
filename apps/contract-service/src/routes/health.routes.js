import { Router } from 'express';
import { getMongoStatus } from '../infrastructure/mongodb/connect.js';

const healthRoutes = Router();
const startTime = Date.now();

function meta(req) {
  return {
    requestId: req.headers['x-request-id'] ?? req.id ?? null,
    timestamp: new Date().toISOString(),
  };
}

healthRoutes.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      service: 'contract-service',
      version: process.env.npm_package_version ?? '0.1.0',
      uptime: Math.floor((Date.now() - startTime) / 1000),
    },
    meta: meta(req),
  });
});

healthRoutes.get('/ready', (req, res) => {
  const mongodb = getMongoStatus();
  const ready = mongodb === 'up';

  res.status(ready ? 200 : 503).json({
    success: ready,
    data: {
      status: ready ? 'ready' : 'not_ready',
      dependencies: { mongodb },
    },
    meta: meta(req),
  });
});

export default healthRoutes;
