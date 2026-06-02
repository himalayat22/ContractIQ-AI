import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { registerIdentityProxies, IDENTITY_SERVICE_URL } from './routes/proxy.config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const PORT = Number(process.env.API_GATEWAY_PORT ?? 4000);
const startTime = Date.now();

function meta(req) {
  return {
    requestId: req.headers['x-request-id'] ?? req.id ?? null,
    timestamp: new Date().toISOString(),
  };
}

function correlationId(req, res, next) {
  const id = req.headers['x-request-id'] ?? randomUUID();
  req.id = id;
  res.setHeader('X-Request-ID', id);
  next();
}

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
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      service: 'api-gateway',
      version: process.env.npm_package_version ?? '0.1.0',
      uptime: Math.floor((Date.now() - startTime) / 1000),
    },
    meta: meta(req),
  });
});

app.get('/api/v1/ready', async (req, res) => {
  let identity = 'down';

  try {
    const response = await fetch(`${IDENTITY_SERVICE_URL}/api/v1/ready`, {
      signal: AbortSignal.timeout(5_000),
    });
    const body = await response.json();
    identity = response.ok && body?.data?.status === 'ready' ? 'up' : 'down';
  } catch {
    identity = 'down';
  }

  const ready = identity === 'up';

  res.status(ready ? 200 : 503).json({
    success: ready,
    data: {
      status: ready ? 'ready' : 'not_ready',
      dependencies: {
        identity,
      },
    },
    meta: meta(req),
  });
});

registerIdentityProxies(app);

app.use('/api/v1', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
      details: [],
    },
    meta: meta(req),
  });
});

app.listen(PORT, () => {
  console.log(`[api-gateway] Listening on http://localhost:${PORT}`);
  console.log(`[api-gateway] Health: http://localhost:${PORT}/api/v1/health`);
  console.log(`[api-gateway] Proxying identity: ${IDENTITY_SERVICE_URL}`);
});
