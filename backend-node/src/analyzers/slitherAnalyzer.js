/**
 * slitherAnalyzer
 *
 * Integrates with Slither (optional) by invoking it as a subprocess.
 *
 * This module is async and always returns structured JSON.
 * If Slither isn't installed, it returns a "skipped" result instead of failing the whole pipeline.
 */

import { spawn } from "node:child_process";

function run(cmd, args, { timeoutMs = 60_000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    const out = [];
    const err = [];

    child.stdout.on("data", (d) => out.push(d));
    child.stderr.on("data", (d) => err.push(d));

    let killed = false;
    const t = setTimeout(() => {
      killed = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(t);
      resolve({
        ok: code === 0 && !killed,
        code: killed ? null : code,
        stdout: Buffer.concat(out).toString("utf8"),
        stderr: Buffer.concat(err).toString("utf8"),
        timedOut: killed,
      });
    });

    child.on("error", (e) => {
      clearTimeout(t);
      resolve({ ok: false, code: null, stdout: "", stderr: String(e?.message || e), timedOut: false });
    });
  });
}

/**
 * @param {{workDir:string, targetFile:string}} params
 * @returns {Promise<{tool:'slither', status:'ok'|'skipped'|'error', findings:any[], raw?:any, message?:string}>}
 */
export async function runSlither({ workDir: _workDir, targetFile }) {
  // Slither must exist in PATH.
  // Example command: slither Contract.sol --json -
  const res = await run("slither", [targetFile, "--json", "-"], { timeoutMs: 90_000 });

  if (res.stderr?.includes("not found") || res.stderr?.includes("ENOENT")) {
    return {
      tool: "slither",
      status: "skipped",
      findings: [],
      message: "Slither not installed or not on PATH. Install it to enable this analyzer.",
    };
  }

  if (!res.ok) {
    return {
      tool: "slither",
      status: "error",
      findings: [],
      message: res.stderr || res.stdout || "Slither failed",
    };
  }

  let data;
  try {
    data = JSON.parse(res.stdout);
  } catch {
    return {
      tool: "slither",
      status: "error",
      findings: [],
      message: "Slither output was not valid JSON.",
      raw: { stdout: res.stdout, stderr: res.stderr },
    };
  }

  // Slither JSON schema varies; normalize to findings array.
  const detectors = data?.results?.detectors;
  const findings = Array.isArray(detectors)
    ? detectors.map((d) => ({
        id: d.check,
        impact: d.impact,
        confidence: d.confidence,
        description: d.description,
        elements: d.elements,
      }))
    : [];

  return { tool: "slither", status: "ok", findings, raw: data };
}
