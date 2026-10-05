import type { PublicUser } from '../users/types';

export interface ISession {
  _id: string;
  userId: string;
  familyId: string;
  jti: string;
  tokenHash: string;
  deviceId: string | null;
  userAgent: string | null;
  ip: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedByJti: string | null;
  createdAt: Date;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

export interface AuthResult extends TokenPair {
  user: PublicUser;
}

export interface ClientContext {
  deviceId?: string | null;
  userAgent?: string | null;
  ip?: string | null;
}
