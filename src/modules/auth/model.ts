import { Schema, model } from 'mongoose';
import type { ISession } from './types';

/** Collection: refresh_tokens (one row per issued refresh token; rotated on every use). */
const sessionSchema = new Schema<ISession>(
  {
    userId: { type: String, required: true, index: true },
    familyId: { type: String, required: true, index: true },
    jti: { type: String, required: true, unique: true },
    // Only a SHA-256 hash of the token is stored, never the token itself.
    tokenHash: { type: String, required: true },
    deviceId: { type: String, default: null },
    userAgent: { type: String, default: null, maxlength: 300 },
    ip: { type: String, default: null },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedByJti: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'refresh_tokens' },
);

// Automatically purge expired sessions.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SessionModel = model<ISession>('RefreshToken', sessionSchema);
