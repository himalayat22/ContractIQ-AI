import { AppError } from '../../../utils/AppError.js';

function notImplemented(method) {
  throw new AppError(`AuthService.${method} is not implemented yet`, {
    statusCode: 501,
    code: 'NOT_IMPLEMENTED',
  });
}

/**
 * Placeholder — auth business logic to be implemented.
 * Required so AuthController and routes can load at startup.
 */
export default class AuthService {
  register() {
    return notImplemented('register');
  }

  login() {
    return notImplemented('login');
  }

  refresh() {
    return notImplemented('refresh');
  }

  logout() {
    return notImplemented('logout');
  }

  forgotPassword() {
    return notImplemented('forgotPassword');
  }

  resetPassword() {
    return notImplemented('resetPassword');
  }

  verifyEmail() {
    return notImplemented('verifyEmail');
  }

  getMe() {
    return notImplemented('getMe');
  }

  switchTenant() {
    return notImplemented('switchTenant');
  }

  listSessions() {
    return notImplemented('listSessions');
  }

  revokeSession() {
    return notImplemented('revokeSession');
  }
}
