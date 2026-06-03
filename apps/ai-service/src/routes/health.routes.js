import { Router } from 'express';
import { getConfig } from '../config/env.js';
import { getMongoStatus } from '../infrastructure/mongodb/connect.js';
import { getRedisStatus } from '../infrastructure/redis/connection.js';

const healthRoutes = Router();
const startTime = Date.now();

function meta(req) {
  return {
    requestId: req.headers['x-request-id'] ?? req.id ?? null,
    timestamp: new Date().toISOString(),
  };
}

healthRoutes.get('/health', (req, res) => {
  const config = getConfig();

  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      service: 'ai-service',
      version: process.env.npm_package_version ?? '0.1.0',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      provider: 'google-gemini',
      model: config.geminiModel,
      geminiConfigured: Boolean(config.geminiApiKey),
    },
    meta: meta(req),
  });
});

healthRoutes.get('/ready', (req, res) => {
  const mongodb = getMongoStatus();
  const redis = getRedisStatus();
  const ready = mongodb === 'up' && redis === 'up';

  res.status(ready ? 200 : 503).json({
    success: ready,
    data: {
      status: ready ? 'ready' : 'not_ready',
      dependencies: { mongodb, redis },
    },
    meta: meta(req),
  });
});

export default healthRoutes;
