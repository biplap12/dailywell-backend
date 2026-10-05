import argon2 from 'argon2';
import { v4 as uuid } from 'uuid';
import { AuthenticationError, AuthorizationError, ConflictError } from '../../common/errors';
import { decodeExpiry, signAccessToken, signRefreshToken, verifyRefreshToken } from '../../common/utils/jwt';
import { sha256 } from '../../common/utils/crypto';
import { configService } from '../config/service';
import { userRepository } from '../users/repository';
import { toPublicUser } from '../users/service';
import type { UserDocument } from '../users/model';
import { auditService } from '../audit/service';
import { sessionRepository } from './repository';
import type { AuthResult, ClientContext, TokenPair } from './types';

// OWASP-recommended argon2id parameters (19 MiB, 2 iterations, 1 lane).
const ARGON_OPTIONS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

// Used to burn equivalent CPU time when the email is unknown (prevents user enumeration by timing).
let dummyHashPromise: Promise<string> | null = null;
function dummyHash(): Promise<string> {
  dummyHashPromise ??= argon2.hash('dailywell-dummy-password', ARGON_OPTIONS);
  return dummyHashPromise;
}

async function issueTokens(user: UserDocument, ctx: ClientContext, familyId = uuid()): Promise<TokenPair> {
  const userId = String(user._id);
  const jti = uuid();
  const sid = familyId;

  const accessToken = signAccessToken({ sub: userId, role: user.role, sid });
  const refreshToken = signRefreshToken({ sub: userId, sid, jti, fam: familyId });
  const refreshExp = decodeExpiry(refreshToken);

  await sessionRepository.create({
    userId,
    familyId,
    jti,
    tokenHash: sha256(refreshToken),
    deviceId: ctx.deviceId ?? null,
    userAgent: ctx.userAgent ?? null,
    ip: ctx.ip ?? null,
    expiresAt: refreshExp,
  });

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    accessTokenExpiresAt: decodeExpiry(accessToken),
    refreshTokenExpiresAt: refreshExp,
  };
}

function assertUsable(user: UserDocument): void {
  if (!user.isActive) throw new AuthorizationError('Account is deactivated');
  if (user.isSuspended) throw new AuthorizationError('Account is suspended');
}

export const authService = {
  async register(
    input: { name: string; email: string; phone: string; password: string },
    ctx: ClientContext,
  ): Promise<AuthResult> {
    const cfg = await configService.get();
    if (!cfg.registrationEnabled) throw new AuthorizationError('Registration is currently disabled');

    if (await userRepository.findByEmail(input.email)) {
      throw new ConflictError('An account with this email already exists');
    }

    const passwordHash = await argon2.hash(input.password, ARGON_OPTIONS);
    let user: UserDocument;
    try {
      user = await userRepository.create({
        name: input.name,
        email: input.email,
        phone: input.phone,
        passwordHash,
        role: 'USER', // never taken from the request
      });
    } catch (err) {
      // Race between the existence check and insert: unique index is the final arbiter.
      if ((err as { code?: number }).code === 11000) throw new ConflictError('An account with this email already exists');
      throw err;
    }

    await auditService.record({ actorId: String(user._id), action: 'AUTH_REGISTER', entityType: 'user', entityId: String(user._id), ip: ctx.ip });
    const tokens = await issueTokens(user, ctx);
    return { ...tokens, user: toPublicUser(user) };
  },

  async login(input: { email: string; password: string }, ctx: ClientContext): Promise<AuthResult> {
    const user = await userRepository.findByEmailWithPassword(input.email);

    if (!user || !user.passwordHash) {
      await argon2.verify(await dummyHash(), input.password).catch(() => false);
      throw new AuthenticationError('Invalid email or password', 'INVALID_CREDENTIALS');
    }
    const ok = await argon2.verify(user.passwordHash, input.password).catch(() => false);
    if (!ok) {
      await auditService.record({ actorId: String(user._id), action: 'AUTH_LOGIN_FAILED', entityType: 'user', entityId: String(user._id), ip: ctx.ip });
      throw new AuthenticationError('Invalid email or password', 'INVALID_CREDENTIALS');
    }
    assertUsable(user);

    await userRepository.touchLogin(String(user._id));
    user.lastLoginAt = new Date();
    await auditService.record({ actorId: String(user._id), action: 'AUTH_LOGIN', entityType: 'user', entityId: String(user._id), ip: ctx.ip });
    const tokens = await issueTokens(user, ctx);
    return { ...tokens, user: toPublicUser(user) };
  },

  /**
   * Refresh-token rotation with reuse detection:
   * every refresh token is single-use. Presenting an already-used token means it
   * was probably stolen, so the whole token family is revoked.
   */
  async refresh(refreshToken: string, ctx: ClientContext): Promise<AuthResult> {
    const payload = verifyRefreshToken(refreshToken);
    const session = await sessionRepository.findByJti(payload.jti);

    if (!session || session.tokenHash !== sha256(refreshToken) || session.userId !== payload.sub) {
      throw new AuthenticationError('Invalid refresh token', 'INVALID_TOKEN');
    }
    if (session.revokedAt) {
      await sessionRepository.revokeFamily(session.familyId);
      await auditService.record({ actorId: session.userId, action: 'AUTH_REFRESH_REUSE_DETECTED', entityType: 'session', entityId: session.familyId, ip: ctx.ip });
      throw new AuthenticationError('Refresh token has already been used', 'TOKEN_REUSED');
    }

    const user = await userRepository.findById(session.userId);
    if (!user) throw new AuthenticationError('Account no longer exists', 'INVALID_TOKEN');
    assertUsable(user);

    // Atomic claim: only one concurrent request can rotate this token.
    const newJtiPlaceholder = uuid();
    const claimed = await sessionRepository.revokeIfActive(session.jti, newJtiPlaceholder);
    if (!claimed) {
      await sessionRepository.revokeFamily(session.familyId);
      throw new AuthenticationError('Refresh token has already been used', 'TOKEN_REUSED');
    }

    const tokens = await issueTokens(user, { ...ctx, deviceId: ctx.deviceId ?? session.deviceId }, session.familyId);
    return { ...tokens, user: toPublicUser(user) };
  },

  async logout(refreshToken: string): Promise<void> {
    // Idempotent: an invalid/expired token simply means there is nothing left to revoke.
    try {
      const payload = verifyRefreshToken(refreshToken);
      const session = await sessionRepository.findByJti(payload.jti);
      if (session && session.tokenHash === sha256(refreshToken)) {
        await sessionRepository.revokeFamily(session.familyId);
      }
    } catch {
      /* ignore */
    }
  },

  async createGuest(ctx: ClientContext): Promise<AuthResult> {
    const cfg = await configService.get();
    if (!cfg.guestAccessEnabled) throw new AuthorizationError('Guest access is currently disabled');
    const user = await userRepository.create({ name: 'Guest', role: 'GUEST' });
    const tokens = await issueTokens(user, ctx);
    return { ...tokens, user: toPublicUser(user) };
  },
};
