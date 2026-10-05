import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';
import { AuthenticationError } from '../errors';
import type { Role } from '../constants';

const ISSUER = 'dailywell-api';
const AUDIENCE = 'dailywell-clients';

export interface AccessPayload {
  sub: string;
  role: Role;
  sid: string;
  typ: 'access';
}

export interface RefreshPayload {
  sub: string;
  sid: string;
  jti: string;
  fam: string;
  typ: 'refresh';
}

export function signAccessToken(payload: Omit<AccessPayload, 'typ'>): string {
  return jwt.sign({ ...payload, typ: 'access' }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    issuer: ISSUER,
    audience: AUDIENCE,
  } as SignOptions);
}

export function signRefreshToken(payload: Omit<RefreshPayload, 'typ'>): string {
  return jwt.sign({ ...payload, typ: 'refresh' }, env.JWT_REFRESH_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    issuer: ISSUER,
    audience: AUDIENCE,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    }) as AccessPayload;
    if (decoded.typ !== 'access') throw new Error('wrong token type');
    return decoded;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) throw new AuthenticationError('Access token expired', 'TOKEN_EXPIRED');
    throw new AuthenticationError('Invalid access token', 'INVALID_TOKEN');
  }
}

export function verifyRefreshToken(token: string): RefreshPayload & { exp: number } {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    }) as RefreshPayload & { exp: number };
    if (decoded.typ !== 'refresh') throw new Error('wrong token type');
    return decoded;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) throw new AuthenticationError('Refresh token expired', 'TOKEN_EXPIRED');
    throw new AuthenticationError('Invalid refresh token', 'INVALID_TOKEN');
  }
}

export function decodeExpiry(token: string): Date {
  const decoded = jwt.decode(token) as { exp?: number } | null;
  if (!decoded?.exp) throw new Error('Token has no expiry');
  return new Date(decoded.exp * 1000);
}
