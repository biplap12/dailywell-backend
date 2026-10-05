import type { Server } from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { connectRedis, disconnectRedis } from "./config/redis";
import { logger } from "./common/utils/logger";
import { configService } from "./modules/config/service";
import mongoose from "mongoose";

async function bootstrap(): Promise<void> {
  await connectDatabase();
  await connectRedis();

  // Make sure every collection has its indexes (unique constraints are load-bearing for idempotency).
  await mongoose.syncIndexes();
  // Ensures the remote config document exists with defaults.
  await configService.get();

  const app = createApp();
  const server: Server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV },
      `DailyWell API listening on :${env.PORT} (docs at /api/docs)`,
    );
    logger.info("http://192.168.1.66:5000/api/v1/");
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Shutting down");
    server.close(async () => {
      await disconnectRedis();
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception");
  process.exit(1);
});

bootstrap().catch((err) => {
  logger.fatal({ err }, "Failed to start server");
  process.exit(1);
});
