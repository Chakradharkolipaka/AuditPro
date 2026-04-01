import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import tmp from "tmp";
import fs from "fs-extra";

const execFileAsync = promisify(execFile);

function mapFinding(d) {
  return {
    id: d?.check || "slither-finding",
    impact: String(d?.impact || "Medium").toLowerCase(),
    confidence: String(d?.confidence || "Medium").toLowerCase(),
    description: d?.description || "Slither finding",
    elements: d?.elements || [],
  };
}

/**
 * Runs slither on source code via temporary directory and returns normalized findings.
 * @param {{sourceCode:string, filename:string, timeoutMs?:number}} params
 */
export async function runSlitherTemp({ sourceCode, filename = "Contract.sol", timeoutMs = 90_000 }) {
  const dir = tmp.dirSync({ unsafeCleanup: true });
  const contractPath = path.join(dir.name, filename.endsWith(".sol") ? filename : "Contract.sol");
  const outputPath = path.join(dir.name, "result.json");

  try {
    await fs.writeFile(contractPath, String(sourceCode || ""), "utf8");

    await execFileAsync("slither", [contractPath, "--json", outputPath], {
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024 * 5,
    });

    const raw = await fs.readJson(outputPath);
    const detectors = raw?.results?.detectors;

    return {
      tool: "slither",
      status: "ok",
      findings: Array.isArray(detectors) ? detectors.map(mapFinding) : [],
      raw,
    };
  } catch (err) {
    const msg = String(err?.message || err);
    if (/ENOENT|not found/i.test(msg)) {
      return {
        tool: "slither",
        status: "skipped",
        findings: [],
        message: "Slither not installed on worker host.",
      };
    }

    return {
      tool: "slither",
      status: "error",
      findings: [],
      message: `Slither analysis failed: ${msg}`,
    };
  } finally {
    dir.removeCallback();
  }
}
