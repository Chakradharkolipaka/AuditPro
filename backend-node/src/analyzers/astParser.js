/**
 * astParser
 *
 * Minimal Solidity AST extraction.
 *
 * We avoid heavyweight dependencies in-node.
 * For richer ASTs, add solidity-parser-antlr later.
 *
 * Output is structured JSON for downstream analyzers.
 */

/**
 * @param {string} source
 * @returns {Promise<{ok:true, summary:{pragma?:string, contracts:string[], functions:number}, warnings:string[]}>}
 */
export async function parseSolidityAst(source) {
  const s = String(source || "");

  // Cheap parsing heuristics for MVP.
  const pragma = (s.match(/pragma\s+solidity\s+([^;]+);/i)?.[1] || "").trim() || undefined;

  const contractNames = [];
  const contractRe = /\b(contract|interface|library)\s+([A-Za-z_][A-Za-z0-9_]*)/g;
  let m;
  while ((m = contractRe.exec(s))) contractNames.push(m[2]);

  const fnCount = (s.match(/\bfunction\b/g) || []).length;

  const warnings = [];
  if (!pragma) warnings.push("No pragma solidity found.");
  if (!contractNames.length) warnings.push("No contract/interface/library declarations found.");

  return {
    ok: true,
    summary: {
      pragma,
      contracts: contractNames,
      functions: fnCount,
    },
    warnings,
  };
}
