import type { RequestHandler } from 'express';
import { AuthenticationError, AuthorizationError } from '../errors';
import { verifyAccessToken } from '../utils/jwt';
import { ROLE_PERMISSIONS, ROLE_RANK, type Permission, type Role } from '../constants';
import { UserModel } from '../../modules/users/model';

/**
 * Derives identity exclusively from the Bearer access token.
 * The role is re-read from the database so that suspensions and role changes
 * take effect immediately instead of waiting for token expiry.
 */
export function authenticate(): RequestHandler {
  return async (req, _res, next) => {
    try {
      const header = req.header('authorization');
      const match = header?.match(/^Bearer\s+(\S+)$/i);
      if (!match) throw new AuthenticationError('Missing or malformed Authorization header');

      const payload = verifyAccessToken(match[1]);
      const user = await UserModel.findById(payload.sub).select('role isActive isSuspended').lean();
      if (!user) throw new AuthenticationError('Account no longer exists', 'INVALID_TOKEN');
      if (!user.isActive) throw new AuthorizationError('Account is deactivated');
      if (user.isSuspended) throw new AuthorizationError('Account is suspended');

      req.auth = { userId: String(user._id), role: user.role as Role, sessionId: payload.sid };
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Requires the caller's role to grant the given permission. Use after authenticate(). */
export function authorize(permission: Permission): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(new AuthenticationError());
    if (!ROLE_PERMISSIONS[req.auth.role].includes(permission)) {
      return next(new AuthorizationError(`Missing required permission: ${permission}`));
    }
    next();
  };
}

/** Requires one of the listed roles exactly. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(new AuthenticationError());
    if (!roles.includes(req.auth.role)) return next(new AuthorizationError('Your role cannot access this resource'));
    next();
  };
}

/** Requires a role at least as privileged as `min`. */
export function requireMinRole(min: Role): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(new AuthenticationError());
    if (ROLE_RANK[req.auth.role] < ROLE_RANK[min]) {
      return next(new AuthorizationError('Your role cannot access this resource'));
    }
    next();
  };
}

/** Requires ALL listed permissions. */
export function requirePermission(...permissions: Permission[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(new AuthenticationError());
    const granted = ROLE_PERMISSIONS[req.auth.role];
    const missing = permissions.filter((p) => !granted.includes(p));
    if (missing.length) return next(new AuthorizationError(`Missing required permission: ${missing.join(', ')}`));
    next();
  };
}
