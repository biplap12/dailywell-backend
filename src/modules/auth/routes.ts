import { Router } from 'express';
import { authenticate, authorize } from '../../common/middleware/auth';
import { authLimiter } from '../../common/middleware/rateLimit';
import { bearerHeader } from '../../common/validators';
import { doc } from '../../docs/registry';
import { authController } from './controller';
import { guestBody, loginBody, logoutBody, refreshBody, registerBody } from './schema';

const router = Router();

router.post(
  '/register',
  authLimiter,
  ...doc({ method: 'post', path: '/auth/register', tags: ['Auth'], summary: 'Register a new account', body: registerBody, successStatus: 201, rateLimited: true }),
  authController.register,
);

router.post(
  '/login',
  authLimiter,
  ...doc({ method: 'post', path: '/auth/login', tags: ['Auth'], summary: 'Log in with email and password', body: loginBody, rateLimited: true }),
  authController.login,
);

router.post(
  '/refresh',
  authLimiter,
  ...doc({ method: 'post', path: '/auth/refresh', tags: ['Auth'], summary: 'Rotate refresh token and get a new access token', description: 'Refresh tokens are single-use. Reusing one revokes the whole session family.', body: refreshBody, rateLimited: true }),
  authController.refresh,
);

router.post(
  '/logout',
  authLimiter,
  ...doc({ method: 'post', path: '/auth/logout', tags: ['Auth'], summary: 'Revoke the session for a refresh token', body: logoutBody, rateLimited: true }),
  authController.logout,
);

router.post(
  '/guest',
  authLimiter,
  ...doc({ method: 'post', path: '/auth/guest', tags: ['Auth', 'Guest'], summary: 'Create a restricted guest session', successStatus: 201, body: guestBody, rateLimited: true }),
  authController.guest,
);

router.get(
  '/profile',
  authenticate(),
  authorize('READ'),
  ...doc({ method: 'get', path: '/auth/profile', tags: ['Auth'], summary: 'Get the authenticated user profile', auth: true, headers: bearerHeader }),
  authController.profile,
);

export default router;
