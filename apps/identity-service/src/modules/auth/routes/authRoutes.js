import { Router } from 'express';
import authController from '../controllers/AuthController.js';
import { authenticateJwt } from '../../../middleware/authenticateJwt.js';

/**
 * Auth routes — mount at `/auth` (full path: `/api/v1/auth/*`).
 * @see docs/API_DESIGN.md §4
 */
const authRoutes = Router();

// Public (PUB / RT)
authRoutes.post('/register', authController.register);
authRoutes.post('/login', authController.login);
authRoutes.post('/refresh', authController.refresh);
authRoutes.post('/forgot-password', authController.forgotPassword);
authRoutes.post('/reset-password', authController.resetPassword);
authRoutes.get('/verify-email/:token', authController.verifyEmail);

// Authenticated (JWT)
authRoutes.post('/logout', authenticateJwt, authController.logout);
authRoutes.get('/me', authenticateJwt, authController.me);
authRoutes.post('/switch-tenant', authenticateJwt, authController.switchTenant);
authRoutes.get('/sessions', authenticateJwt, authController.listSessions);
authRoutes.delete('/sessions/:sessionId', authenticateJwt, authController.revokeSession);

export default authRoutes;
