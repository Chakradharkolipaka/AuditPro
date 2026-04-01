import { v4 as uuidv4 } from "uuid";

import { createApp, attachErrorHandler } from "./_lib/app.js";
import { upload } from "./_lib/upload.js";
import { connectMongo } from "../src/database/mongo.js";
import { sha256Hex } from "../src/utils/hash.js";
import { validateSourceByLanguage } from "../src/utils/sourceValidation.js";
import { detectLanguage } from "../src/services/languageSupport.js";
import { requireAuth } from "../src/middlewares/auth.js";

import { getAuditQueue, MAX_WAITING_JOBS } from "../src/queue/auditQueue.js";
import { AuditJob } from "../src/database/models/AuditJob.js";
import { AuditReport } from "../src/database/models/AuditReport.js";
import { User } from "../src/database/models/User.js";
import { logger } from "../src/utils/logger.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

const app = createApp();

// POST /api/audit : upload + enqueue job
app.post("/api/audit", requireAuth, upload.single("file"), async (req, res) => {
  const maxSourceBytes = Number(process.env.MAX_SOURCE_BYTES || 200_000);

  if (!req.file) {
    return res.status(400).json({ code: "MISSING_FILE", message: "Missing file" });
  }

  if (req.file.size > maxSourceBytes) {
    return res.status(413).json({ code: "FILE_TOO_LARGE", message: "File too large" });
  }

  const contractName = req.file.originalname;
  const detected = detectLanguage(contractName);
  if (!detected.ok) {
    return res.status(400).json({ code: "UNSUPPORTED_LANGUAGE", message: "Unsupported language/extension" });
  }

  const language = detected.language;
  const protocol = String(req.body?.protocol || "unknown").trim() || "unknown";
  const sourceCode = req.file.buffer.toString("utf8");

  const valid = validateSourceByLanguage({ source: sourceCode, language });
  if (!valid.ok) {
    return res.status(400).json({ code: "INVALID_SOURCE", message: `Invalid ${language}: ${valid.error}` });
  }

  const contractHash = sha256Hex(`${contractName}\n${sourceCode}`);
  const userId = req.user.uid;

  await connectMongo();

  await User.updateOne(
    { uid: userId },
    {
      $set: {
        uid: userId,
        email: req.user.email,
        name: req.user.name,
        picture: req.user.picture,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  // If we already have a report, return it immediately (fast path)
  const existing = await AuditReport.findOne({ contractHash, userId }).sort({ createdAt: -1 }).lean();
  if (existing) {
    return res.status(200).json({
      status: "completed",
      contractHash,
      language,
      report: existing,
    });
  }

  const jobId = uuidv4();

  await AuditJob.create({
    jobId,
    userId,
    contractHash,
    contractName,
    language,
    protocol,
    status: "queued",
    progress: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const queue = getAuditQueue();
  const waiting = await queue.getWaitingCount();
  if (waiting > MAX_WAITING_JOBS) {
    return res.status(429).json({ code: "QUEUE_OVERLOADED", message: "Too many pending audits. Try again later." });
  }

  await queue.add(
    "audit",
    {
      jobId,
      userId,
      contractHash,
      contractName,
      language,
      protocol,
      sourceCode,
    }
  );

  return res.status(202).json({
    status: "queued",
    jobId,
    contractHash,
    language,
    protocol,
  });
});

// GET /api/audit?jobId=... OR ?contractHash=...
app.get("/api/audit", requireAuth, async (req, res) => {
  try {
    await connectMongo();

    const { jobId, contractHash, language, protocol, fromDate, toDate, sortBy = "createdAt", sortOrder = "desc" } = req.query;
    const userId = req.user.uid;

    if (jobId) {
      const job = await AuditJob.findOne({ jobId: String(jobId), userId }).lean();
      if (!job) return res.status(404).json({ code: "JOB_NOT_FOUND", message: "Job not found" });

      if (job.status === "completed") {
        const report = await AuditReport.findOne({ contractHash: job.contractHash, userId }).sort({ createdAt: -1 }).lean();
        return res.json({ status: job.status, job, report });
      }

      return res.json({ status: job.status, job });
    }

    if (contractHash) {
      const report = await AuditReport.findOne({ contractHash: String(contractHash), userId }).sort({ createdAt: -1 }).lean();
      if (!report) return res.status(404).json({ code: "REPORT_NOT_FOUND", message: "Report not found" });
      return res.json({ status: "completed", contractHash: String(contractHash), report });
    }

    const query = { userId };
    if (language) query.language = String(language);
    if (protocol) query.protocol = String(protocol);
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(String(fromDate));
      if (toDate) query.createdAt.$lte = new Date(String(toDate));
    }

    const allowSort = new Set(["createdAt", "securityScore", "language", "protocol"]);
    const resolvedSortBy = allowSort.has(String(sortBy)) ? String(sortBy) : "createdAt";
    const sort = { [resolvedSortBy]: String(sortOrder) === "asc" ? 1 : -1 };

    const history = await AuditReport.find(query).sort(sort).limit(50).lean();
    return res.json({ status: "ok", history });
  } catch (error) {
    logger.error("history_query_failed", { error: error?.message || String(error) });
    return res.status(500).json({ code: "QUERY_FAILED", message: "Failed to fetch audit history" });
  }
});

attachErrorHandler(app);

export default app;
