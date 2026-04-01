/**
 * defiPatternAnalyzer
 *
 * Detects DeFi / token / governance patterns using light AST + string checks.
 * Output is structured JSON.
 */

import parser from "solidity-parser-antlr";

/**
 * @param {{source:string}} params
 * @returns {Promise<{defiPatterns:Array<{pattern:string,confidence:'low'|'medium'|'high',details:string}>}>}
 */
export async function analyzeDefiPatterns({ source }) {
  const s = String(source || "");
  const defiPatterns = [];

  const add = (pattern, confidence, details) => {
    defiPatterns.push({ pattern, confidence, details });
  };

  // quick string signals
  if (/\bIERC20\b|\bERC20\b|\btransfer\b\s*\(|\bbalanceOf\b\s*\(/.test(s)) {
    add("erc20-like", "medium", "Detected IERC20/ERC20 symbols or common ERC20 functions.");
  }
  if (/\bIERC721\b|\bERC721\b|\bownerOf\b\s*\(|\bsafeTransferFrom\b\s*\(/.test(s)) {
    add("erc721-like", "medium", "Detected IERC721/ERC721 symbols or common ERC721 functions.");
  }
  if (/\bTimelock\b|\bGovernor\b|\bproposal\b|\bquorum\b/i.test(s)) {
    add("dao-governance", "low", "Detected DAO governance keywords (Governor/Timelock/proposal/quorum). Confirm semantics.");
  }
  if (/\bProxy\b|\bUpgradeable\b|\bUUPS\b|\bTransparentUpgradeableProxy\b/i.test(s)) {
    add("upgradeable-proxy", "high", "Detected upgradeable proxy related keywords (UUPS/TransparentUpgradeableProxy). Review initialization and admin controls.");
  }
  if (/SafeMath/i.test(s) && /pragma\s+solidity\s+\^?0\.8\./i.test(s)) {
    add("safemath-unnecessary", "low", "SafeMath used with Solidity 0.8+. It’s usually redundant (but may still be fine for clarity).");
  }
  if (/unchecked\s*\{/.test(s)) {
    add("unchecked-math", "medium", "Found unchecked blocks. Ensure bounds/invariants are enforced." );
  }

  // AST checks for ERC20 function surface
  try {
    const ast = parser.parse(s, { tolerant: true, loc: true });
    const functionNames = new Set();
    parser.visit(ast, {
      FunctionDefinition(node) {
        if (node?.name) functionNames.add(node.name);
      },
    });

    const erc20Surface = ["totalSupply", "balanceOf", "transfer", "transferFrom", "approve", "allowance"];
    const erc20Hits = erc20Surface.filter((n) => functionNames.has(n));
    if (erc20Hits.length >= 4) {
      add("erc20-surface-implementation", "high", `Implements many ERC20 surface functions: ${erc20Hits.join(", ")}`);
    }

    const erc721Surface = ["ownerOf", "balanceOf", "approve", "getApproved", "setApprovalForAll", "isApprovedForAll", "transferFrom", "safeTransferFrom"];
    const erc721Hits = erc721Surface.filter((n) => functionNames.has(n));
    if (erc721Hits.length >= 5) {
      add("erc721-surface-implementation", "high", `Implements many ERC721 surface functions: ${erc721Hits.join(", ")}`);
    }
  } catch {
    // ignore AST failures - keep string-based signals
  }

  return { defiPatterns };
}
