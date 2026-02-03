import { z } from "zod";

import { analyzeContractRules } from "../services/rulesEngine.js";
import { sha256Hex } from "../utils/hash.js";

const AnalyzeSchema = z.object({
  filename: z.string().min(1).max(200),
  source: z.string().min(1).max(250_000),
});

export async function analyzeContract(req, res, next) {
  try {
    const { filename, source } = AnalyzeSchema.parse(req.body);

    const { risks, explanations } = analyzeContractRules(source);
    const reportHash = sha256Hex(`${filename}\n${source}`);

    res.json({
      filename,
      reportHash,
      risks,
      explanations,
      tests: null,
      proof: null,
    });
  } catch (err) {
    next(err);
  }
}
