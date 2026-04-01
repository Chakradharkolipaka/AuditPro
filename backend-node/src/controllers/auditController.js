import { z } from "zod";

import { sha256Hex } from "../utils/hash.js";
import { runAuditPipeline } from "../services/auditPipeline.js";

const AnalyzeSchema = z.object({
  filename: z.string().min(1).max(200),
  source: z.string().min(1).max(250_000),
});

export async function analyzeContract(req, res, next) {
  try {
    const { filename, source } = AnalyzeSchema.parse(req.body);
    const reportHash = sha256Hex(`${filename}\n${source}`);

    const report = await runAuditPipeline({ filename, source });

    res.json({
      filename,
      reportHash,
      // Backwards compatibility for existing UI components
      risks: report?.vulnerabilities || [],

      // New structured objects for upgraded dashboard
      vulnerabilities: report?.vulnerabilities || [],
      gas: report?.gas || null,
      ast: report?.ast || null,
      security: report?.security || null,
      defi: report?.defi || null,
      openzeppelin: report?.openzeppelin || null,
      explanations: report?.explanations || [],
      recommendations: {
        security:
          "Review high severity findings first. Add tests for access control and reentrancy paths. Consider adding events for critical state changes.",
        gas:
          "Apply low-effort gas suggestions first; benchmark changes with Foundry gas snapshots for meaningful comparisons.",
      },

      tools: report?.tools || {},

      tests: null,
      proof: null,
    });
  } catch (err) {
    next(err);
  }
}
