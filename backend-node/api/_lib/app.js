import express from "express";
import multer from "multer";

import { applySecurity } from "./security.js";
import { logger } from "../../src/utils/logger.js";
import { loadEnv } from "../../src/utils/loadEnv.js";

loadEnv();

export function createApp() {
  const app = express();
  applySecurity(app);

  return app;
}

// Express error middleware must be registered after routes.
export function attachErrorHandler(app) {
  app.use((err, _req, res, _next) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ code: "FILE_TOO_LARGE", message: "Maximum file size is 5MB." });
    }

    const status = err?.status || 500;
    const code = err?.code || (status === 401 ? "UNAUTHORIZED" : status === 429 ? "TOO_MANY_REQUESTS" : "INTERNAL_ERROR");
    const message = err?.message || "Internal Server Error";

    logger.error("api_error", { status, code, message });

    res.status(status).json({ code, message });
  });
}
