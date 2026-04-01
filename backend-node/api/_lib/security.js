import helmet from "helmet";
import rateLimit from "express-rate-limit";
import express from "express";
import { logger } from "../../src/utils/logger.js";

export function applySecurity(app) {
  app.set("trust proxy", 1);
  app.use(helmet());

  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: Number(process.env.RATE_LIMIT_PER_MIN || 60),
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  app.use((req, _res, next) => {
    req.requestId = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    logger.info("request", { requestId: req.requestId, method: req.method, path: req.path });
    next();
  });

  // Basic JSON payload cap (uploads handled via multer)
  app.use(express.json({ limit: "1mb" }));
}
