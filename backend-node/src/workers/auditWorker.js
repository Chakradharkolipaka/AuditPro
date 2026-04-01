import { Worker } from "bullmq";
import { loadEnv } from "../utils/loadEnv.js";

import { connectMongo } from "../database/mongo.js";
import { AuditJob } from "../database/models/AuditJob.js";
import { Contract } from "../database/models/Contract.js";
import { AuditReport } from "../database/models/AuditReport.js";
import { DeadLetterJob } from "../database/models/DeadLetterJob.js";

import { runAuditPipeline } from "../services/auditPipeline.js";
import { analyzeNonSolidity } from "../analyzers/nonSolidityAnalyzer.js";
import { computeSecurityScore } from "../services/securityScore.js";
import { generateAiRecommendations } from "../services/aiReportGenerator.js";
import { getRedisConnection } from "../queue/redis.js";
import { runSlitherTemp } from "../utils/slitherRunner.js";
import { getGasCost } from "../../scripts/getGasCost.js";
import { logger } from "../utils/logger.js";

const MAX_CONCURRENCY = Number(process.env.MAX_CONCURRENT_JOBS || 5);

loadEnv();

export function startAuditWorker() {
  const connection = getRedisConnection();

  const worker = new Worker(
    "audit-jobs",
    async (job) => {
      const startedAt = Date.now();
      const { jobId, userId, contractHash, contractName, language, protocol, sourceCode } = job.data;

      await connectMongo();

      await AuditJob.updateOne(
        { jobId },
        { $set: { status: "running", progress: 5, updatedAt: new Date() } },
        { upsert: true }
      );

      // Upsert contract
      await Contract.updateOne(
        { contractHash, userId },
        { $setOnInsert: { userId, contractHash, contractName, language, sourceCode, createdAt: new Date() } },
        { upsert: true }
      );

      job.updateProgress(10);
      await AuditJob.updateOne({ jobId }, { $set: { progress: 10, updatedAt: new Date() } });

      const timeoutMs = Number(process.env.AUDIT_TIMEOUT_MS || 20_000);

      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);

      let report;
      let slitherResult = { tool: "slither", status: "skipped", findings: [] };
      try {
        if (language === "solidity") {
          slitherResult = await runSlitherTemp({ sourceCode, filename: contractName });
          // NOTE: Slither needs a file; serverless may not support it reliably.
          // We keep slither disabled by default in worker until slither temp-dir integration is added.
          report = await runAuditPipeline({ filename: contractName, source: sourceCode });

          if (Array.isArray(slitherResult.findings) && slitherResult.findings.length) {
            report.vulnerabilities = [
              ...(report?.vulnerabilities || []),
              ...slitherResult.findings.map((f) => ({
                type: f.id || "slither",
                severity: f.impact || "medium",
                line: null,
                description: f.description,
                recommendation: "Review Slither finding details and patch the vulnerable code path.",
                source: "slither",
              })),
            ];
          }
        } else {
          const nonSol = await analyzeNonSolidity({ language, source: sourceCode });
          report = {
            vulnerabilities: nonSol.vulnerabilities,
            gas: { gasIssues: nonSol.gasIssues },
            defi: [],
            openzeppelin: null,
            security: { tool: `${language}-security`, status: "ok", vulnerabilities: nonSol.vulnerabilities },
            explanations: nonSol.recommendations.map((body, i) => ({ title: `Recommendation ${i + 1}`, body })),
          };
        }
      } finally {
        clearTimeout(t);
      }

      job.updateProgress(70);
      await AuditJob.updateOne({ jobId }, { $set: { progress: 70, updatedAt: new Date() } });

      const vulnerabilities = report?.vulnerabilities || [];
      const gasIssues = report?.gas?.gasIssues || [];
      const defiPatterns = report?.defi || [];
      const openzeppelinChecks = report?.openzeppelin || null;

      const { score } = computeSecurityScore({ vulnerabilities });
  const gasEstimate = await getGasCost(contractName.replace(/\.[^/.]+$/, ""));

      // AI recommendations (strict JSON)
      const ai = await generateAiRecommendations({
        contractName,
        sourceCode,
        findings: {
          vulnerabilities,
          gasIssues,
          defiPatterns,
          openzeppelinChecks,
          securityAst: report?.security || null,
        },
      });

      job.updateProgress(90);
      await AuditJob.updateOne({ jobId }, { $set: { progress: 90, updatedAt: new Date() } });

      const stored = await AuditReport.create({
        userId,
        contractHash,
        contractName,
        language,
        protocol,
        sourceCode,
        vulnerabilities,
        gasIssues,
        defiPatterns,
        openzeppelinChecks,
        aiRecommendations: ai?.topFindings || [],
        securityScore: score,
        schemaVersion: "v1.0",
        pipelineVersion: process.env.PIPELINE_VERSION || "pipeline-v1",
        modelVersion: process.env.LLM_MODEL || "unknown-model",
        analyzerVersions: {
          slither: slitherResult?.status === "ok" ? "slither-json-v1" : "unavailable",
          customRules: "v1",
        },
        gasEstimate,
        createdAt: new Date(),
      });

      await AuditJob.updateOne(
        { jobId },
        {
          $set: {
            status: "completed",
            progress: 100,
            updatedAt: new Date(),
          },
        }
      );

      return {
        reportId: String(stored._id),
        durationMs: Date.now() - startedAt,
      };
    },
    { connection, concurrency: MAX_CONCURRENCY }
  );

  worker.on("failed", async (job, err) => {
    try {
      await connectMongo();
      const jobId = job?.data?.jobId || job?.id;
      if (jobId) {
        const attemptsAllowed = Number(job?.opts?.attempts || 1);
        const attemptsMade = Number(job?.attemptsMade || 0);
        const isTerminalFailure = attemptsMade >= attemptsAllowed;

        await AuditJob.updateOne(
          { jobId },
          {
            $set: {
              status: isTerminalFailure ? "failed" : "queued",
              error: err?.message || String(err),
              progress: isTerminalFailure ? 100 : 0,
              updatedAt: new Date(),
            },
          }
        );

        if (isTerminalFailure) {
          await DeadLetterJob.create({
            originalJobId: String(job?.id || jobId),
            userId: job?.data?.userId || null,
            data: job?.data || {},
            error: err?.message || String(err),
            attemptsMade,
            failedAt: new Date(),
          });

          logger.warn("job_moved_to_dlq", {
            jobId: String(job?.id || jobId),
            attemptsMade,
            error: err?.message || String(err),
          });
        } else {
          logger.info("job_retry_scheduled", {
            jobId: String(job?.id || jobId),
            attemptsMade,
            attemptsAllowed,
          });
        }
      }
    } catch (e) {
      console.error("Failed to persist job failure:", e);
    }
  });

  return worker;
}

// Allow running as a standalone worker process.
if (process.argv[1] && process.argv[1].includes("auditWorker")) {
  console.log("Starting audit worker...");
  startAuditWorker();
}
