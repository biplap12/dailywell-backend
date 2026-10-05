import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../common/utils/logger';

mongoose.set('strictQuery', true);
// NOTE: do not enable `sanitizeFilter`. It rewrites every nested $-operator ($gte, $lte, $in...)
// into $eq, which silently breaks the server's own range queries. Injection is blocked earlier:
// sanitizeRequest() rejects $-keys and Zod schemas only allow primitives for every filter input.

export async function connectDatabase(uri: string = env.MONGODB_URI): Promise<typeof mongoose> {
  mongoose.connection.on('error', (err) => logger.error({ err }, 'MongoDB connection error'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, maxPoolSize: 20 });
  logger.info('MongoDB connected');
  return conn;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function isDatabaseHealthy(): boolean {
  return mongoose.connection.readyState === 1;
}
