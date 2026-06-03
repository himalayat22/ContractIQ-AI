import { createProxyMiddleware } from 'http-proxy-middleware';
import { verifyJwt, validateTenantHeader } from '../middleware/verifyJwt.js';

export const IDENTITY_SERVICE_URL =
  process.env.IDENTITY_SERVICE_URL ?? 'http://localhost:4001';

export const CONTRACT_SERVICE_URL =
  process.env.CONTRACT_SERVICE_URL ?? 'http://localhost:4002';

export const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? 'http://localhost:4003';

/**
 * Public auth routes (PUB / RT) — proxied without gateway JWT check.
 * Paths are relative to `/api/v1/auth`.
 * @see docs/API_DESIGN.md §4
 */
const PUBLIC_AUTH_ROUTES = [
  { method: 'POST', path: '/register' },
  { method: 'POST', path: '/login' },
  { method: 'POST', path: '/refresh' },
  { method: 'POST', path: '/forgot-password' },
  { method: 'POST', path: '/reset-password' },
  { method: 'GET', pathPrefix: '/verify-email/' },
];

export function isPublicAuthRoute(req) {
  const path = req.path || '/';
  const method = req.method.toUpperCase();

  return PUBLIC_AUTH_ROUTES.some((route) => {
    if (route.method !== method) {
      return false;
    }
    if (route.pathPrefix) {
      return path.startsWith(route.pathPrefix);
    }
    return path === route.path || path === `${route.path}/`;
  });
}

function isPublicInviteRoute(req) {
  return req.method === 'POST' && (req.path === '/accept' || req.path === '/accept/');
}

function createIdentityProxy() {
  return createProxyMiddleware({
    target: IDENTITY_SERVICE_URL,
    changeOrigin: true,
    on: {
      proxyReq: (proxyReq, req) => {
        const requestId = req.headers['x-request-id'] ?? req.id;
        if (requestId) {
          proxyReq.setHeader('X-Request-ID', requestId);
        }
      },
    },
  });
}

/**
 * Identity-service proxy mounts (MVP).
 * @see docs/SYSTEM_DESIGN.md §0.7
 */
export function registerIdentityProxies(app) {
  const identityProxy = createIdentityProxy();

  // /api/v1/auth — public + JWT routes (identity re-validates JWT on protected handlers)
  app.use(
    '/api/v1/auth',
    (req, res, next) => {
      if (isPublicAuthRoute(req)) {
        return next();
      }
      return verifyJwt(req, res, next);
    },
    identityProxy,
  );

  // /api/v1/users — JWT + tenant (JWT+T)
  app.use('/api/v1/users', verifyJwt, validateTenantHeader, identityProxy);

  // /api/v1/organizations — JWT + tenant
  app.use('/api/v1/organizations', verifyJwt, validateTenantHeader, identityProxy);

  // /api/v1/invites — accept is public; other routes JWT+T
  app.use(
    '/api/v1/invites',
    (req, res, next) => {
      if (isPublicInviteRoute(req)) {
        return next();
      }
      return verifyJwt(req, res, () => validateTenantHeader(req, res, next));
    },
    identityProxy,
  );
}

function createServiceProxy(targetUrl) {
  return createProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,
    on: {
      proxyReq: (proxyReq, req) => {
        const requestId = req.headers['x-request-id'] ?? req.id;
        if (requestId) {
          proxyReq.setHeader('X-Request-ID', requestId);
        }

        if (req.headers.authorization) {
          proxyReq.setHeader('Authorization', req.headers.authorization);
        }

        if (req.headers['x-tenant-id']) {
          proxyReq.setHeader('X-Tenant-ID', req.headers['x-tenant-id']);
        }
      },
    },
  });
}

/**
 * Contract + AI service proxies (MVP — SYSTEM_DESIGN §0.7).
 */
export function registerServiceProxies(app) {
  const contractProxy = createServiceProxy(CONTRACT_SERVICE_URL);
  const aiProxy = createServiceProxy(AI_SERVICE_URL);

  app.use('/api/v1/contracts', verifyJwt, validateTenantHeader, contractProxy);
  app.use('/api/v1/analysis', verifyJwt, validateTenantHeader, aiProxy);
}
