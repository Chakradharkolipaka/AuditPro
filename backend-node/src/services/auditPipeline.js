/**
 * auditPipeline
 *
 * Single orchestration entry point for analyzing a Solidity contract.
 * - Async, modular, reusable
 * - Produces structured JSON for the frontend dashboard
 */

import { analyzeContractRules } from "./rulesEngine.js";
import { parseSolidityAst } from "../analyzers/astParser.js";
import { analyzeGas } from "../analyzers/gasAnalyzer.js";
import { analyzeAstSecurity } from "../analyzers/securityAnalyzer.js";
import { analyzeDefiPatterns } from "../analyzers/defiPatternAnalyzer.js";
import { analyzeOpenZeppelin } from "../analyzers/openzeppelinAnalyzer.js";
import { aggregateVulnerabilities } from "../analyzers/vulnerabilityAggregator.js";
import { runSlither } from "../analyzers/slitherAnalyzer.js";

/**
 * @param {{filename:string, source:string, slither?: {workDir?:string, targetFile?:string, enabled?:boolean}}} input
 */
export async function runAuditPipeline({ filename, source, slither: slitherOpts }) {
  const startedAt = Date.now();

  const shouldRunSlither = Boolean(slitherOpts?.enabled && slitherOpts?.targetFile);

  const [ast, gas, security, defi, openzeppelin, slither] = await Promise.all([
    parseSolidityAst(source),
    analyzeGas(source),
    analyzeAstSecurity({ source }),
    analyzeDefiPatterns({ source }),
    analyzeOpenZeppelin({ source }),
    shouldRunSlither
      ? runSlither({ workDir: slitherOpts?.workDir || process.cwd(), targetFile: slitherOpts.targetFile })
      : Promise.resolve({ tool: "slither", status: "skipped", findings: [], message: "Not executed" }),
  ]);

  const rules = analyzeContractRules(source);
  const agg = await aggregateVulnerabilities({ ruleRisks: rules.risks, slither });

  return {
    ok: true,
    meta: {
      filename,
      analyzedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
    },
    ast,
    security,
    defi,
    openzeppelin,
    vulnerabilities: agg.vulnerabilities,
    gas,
    explanations: rules.explanations,
    tools: {
      rules: { status: "ok" },
      slither,
    },
  };
}
