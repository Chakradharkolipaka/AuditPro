/**
 * gasAnalyzer
 *
 * Lightweight gas heuristics (source-level) that don't require compilation.
 * IMPORTANT: estimates are heuristic; only benchmarking can confirm.
 */

/**
 * @param {string} source
 * @returns {Promise<{tool:'gas', status:'ok', gasIssues:Array<{line:number|null, problem:string, improvement:string, estimatedGasSaving:string}>}>}
 */
export async function analyzeGas(source) {
  const s = String(source || "");
  const lines = s.split(/\r?\n/);

  /** @type {Array<{line:number|null, problem:string, improvement:string, estimatedGasSaving:string}>} */
  const gasIssues = [];

  const add = (line, problem, improvement, estimatedGasSaving) => {
    gasIssues.push({
      line: typeof line === "number" ? line : null,
      problem,
      improvement,
      estimatedGasSaving,
    });
  };

  // 1) constant variables not marked constant / immutable
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    // naive: uint256 FEE = 100;
    if (/\b(uint|uint256|int|int256|address|bytes32|string|bool)\b\s+[A-Z0-9_]{3,}\s*=\s*[^;]+;/.test(ln) && !/\bconstant\b|\bimmutable\b/.test(ln)) {
      add(i + 1, "Potential constant not marked constant/immutable", "Mark compile-time constants as `constant` (or `immutable` if set in constructor).", "Low–Medium");
    }
  }

  // 2) expensive loops: arr.length in loop condition
  if (/\bfor\s*\(/.test(s) && /\blength\b/.test(s)) {
    add(null, "Loop condition uses array.length repeatedly", "Cache `len = arr.length` before loop when safe.", "Low");
  }

  // 3) unnecessary state writes: x = x;
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    const m = ln.match(/\b([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\1\s*;/);
    if (m) {
      add(i + 1, `Unnecessary state/local write: ${m[1]} = ${m[1]}`, "Remove redundant assignments to save gas.", "Low");
    }
  }

  // 4) storage vs memory misuse hints (very heuristic)
  if (/\bstorage\b/.test(s) && /\bview\b/.test(s)) {
    add(null, "Potential storage reads in view paths", "Cache repeated storage reads into memory/local variables.", "Low");
  }

  // 5) inefficient events (indexing)
  if (/event\s+\w+\s*\([^)]*\)/.test(s) && !/indexed/.test(s)) {
    add(null, "Events without indexed fields", "Index commonly-filtered fields (e.g., user, token, id) using `indexed`.", "Low");
  }

  // 6) custom errors suggestion
  if (/\brevert\s*\(/.test(s) && !/\berror\s+[A-Za-z_]/.test(s)) {
    add(null, "Revert strings increase deployment cost", "Use custom errors for cheaper reverts.", "Medium");
  }

  return { tool: "gas", status: "ok", gasIssues };
}
