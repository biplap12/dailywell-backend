import { z } from 'zod';
import { deviceId } from '../../common/validators';

export const registerBody = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().trim().toLowerCase().email().max(254),
    phone: z.string().trim().min(7, 'Phone must be at least 7 characters').max(30),
    password: z.string().min(6, 'Password must be at least 6 characters').max(128),
    deviceId: deviceId.optional(),
  })
  .strict();

export const loginBody = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(128),
    deviceId: deviceId.optional(),
  })
  .strict();

export const refreshBody = z
  .object({
    refreshToken: z.string().min(20).max(2048),
    deviceId: deviceId.optional(),
  })
  .strict();

export const logoutBody = z.object({ refreshToken: z.string().min(20).max(2048) }).strict();

export const guestBody = z.object({ deviceId: deviceId.optional() }).strict();
