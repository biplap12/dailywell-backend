import compression from "compression";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import { API_PREFIX } from "./common/constants";
import {
  errorHandler,
  notFoundHandler,
} from "./common/middleware/errorHandler";
import { generalLimiter } from "./common/middleware/rateLimit";
import { requestId } from "./common/middleware/requestId";
import { requestLogger } from "./common/middleware/requestLogger";
import { sanitizeRequest } from "./common/middleware/sanitize";
import { buildOpenApiDocument } from "./docs/openapi";
import healthRoutes from "./modules/health/routes";
import { createV1Router } from "./routes";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  // Behind a load balancer / reverse proxy, req.ip must be the real client IP for rate limiting.
  app.set("trust proxy", env.isProd ? 1 : false);

  app.use(requestId);
  app.use(requestLogger);

  app.use(helmet());
  app.use(
    cors({
      // Strict allow-list. Requests with no Origin (native Android apps, curl) are not browser CORS requests.
      origin: (origin, cb) => {
        if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
      exposedHeaders: [
        "X-Request-Id",
        "RateLimit-Limit",
        "RateLimit-Remaining",
        "RateLimit-Reset",
      ],
      maxAge: 600,
    }),
  );
  app.use(compression());

  // Small body limit: wellness payloads are tiny, and sync batches are capped at 100 operations.
  app.use(express.json({ limit: "256kb" }));
  app.use(express.urlencoded({ extended: false, limit: "16kb" }));
  app.use(sanitizeRequest);

  // Health probes live outside the versioned API and outside the rate limiter.
  app.use("/api/v1/health", healthRoutes);

  const v1 = createV1Router();
  app.use(API_PREFIX, generalLimiter, v1);

  // OpenAPI is generated from the routes registered above, so it is built after the router.
  const openApiDoc = buildOpenApiDocument();
  app.get("/api/docs.json", (_req, res) => res.json(openApiDoc));
  app.use(
    "/api/docs",
    // Swagger UI needs inline scripts/styles; relax CSP for the docs path only.
    helmet({ contentSecurityPolicy: false }),
    swaggerUi.serve,
    swaggerUi.setup(openApiDoc, { customSiteTitle: "DailyWell API Docs" }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
