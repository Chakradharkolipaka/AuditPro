/**
 * securityAnalyzer (AST-driven)
 *
 * Production-grade analyzer scaffold using `solidity-parser-antlr`.
 *
 * Goals:
 * - structured JSON output
 * - no crashes (parser errors become warnings)
 * - detects common vulnerability patterns using AST signals + lightweight heuristics
 */

import parser from "solidity-parser-antlr";

/**
 * @typedef {'critical'|'high'|'medium'|'low'} Severity
 * @typedef {{type:string,severity:Severity,line:number|null,description:string,recommendation:string}} Vulnerability
 */

function sev(v) {
  /** @type {Record<string, Severity>} */
  const map = { critical: "critical", high: "high", medium: "medium", low: "low" };
  return map[String(v).toLowerCase()] || "medium";
}

function lineOf(node) {
  return node?.loc?.start?.line ?? null;
}

function push(vulns, v) {
  vulns.push({
    type: v.type,
    severity: sev(v.severity),
    line: typeof v.line === "number" ? v.line : null,
    description: v.description,
    recommendation: v.recommendation,
  });
}

function isIdentifier(node, name) {
  return node && node.type === "Identifier" && node.name === name;
}

// Reserved for future richer AST matching (kept here intentionally).
// function isMemberAccess(node, memberName) {
//   return node && node.type === "MemberAccess" && node.memberName === memberName;
// }

function fnName(node) {
  return node?.name || node?.name?.name || "";
}

/**
 * @param {{source:string}} params
 * @returns {Promise<{vulnerabilities:Vulnerability[], warnings:string[]}>}
 */
export async function analyzeAstSecurity({ source }) {
  const vulnerabilities = [];
  const warnings = [];

  const s = String(source || "");

  /** @type {any} */
  let ast;
  try {
    ast = parser.parse(s, { loc: true, range: true, tolerant: true });
  } catch (e) {
    // Parser can throw on severe syntax errors.
    warnings.push(`AST parse failed: ${e?.message || e}`);
    return { vulnerabilities, warnings };
  }

  // High-level signals
  let usesTxOrigin = false;
  // Keep lint happy: flags can be useful for later scoring/telemetry.
  void usesTxOrigin;
  let usesDelegatecall = false;
  let usesSelfdestruct = false;
  let hasOnlyOwnerModifier = false;
  let writesStateInExternalFn = false;

  // Track external calls inside functions to flag "unchecked" style patterns.
  // This is heuristic: flags low-level calls without checking success.
  const lowLevelCalls = [];

  parser.visit(ast, {
    ModifierDefinition(node) {
      if (/onlyOwner/i.test(node?.name || "")) hasOnlyOwnerModifier = true;
    },
    FunctionDefinition(node) {
      const visibility = node?.visibility;
      const stateMutability = node?.stateMutability;
      const name = fnName(node);

      if ((visibility === "external" || visibility === "public") && stateMutability !== "view" && stateMutability !== "pure") {
        // We'll further refine by checking assignments within function body.
        if (node?.body?.statements?.length) {
          for (const st of node.body.statements) {
            if (st?.type === "ExpressionStatement" && st.expression?.type === "Assignment") {
              writesStateInExternalFn = true;
              break;
            }
          }
        }

      }

      // Missing access control heuristic
      const modifiers = Array.isArray(node?.modifiers) ? node.modifiers : [];
      const hasAuthModifier = modifiers.some((m) => /onlyOwner|auth|admin|role/i.test(m?.name || m?.modifierName?.name || ""));
      if ((/withdraw|mint|burn|pause|unpause|upgrade|set/i.test(name) || /owner|admin/i.test(s)) && !hasAuthModifier) {
        // Don't over-alert for constructors.
        if (node?.isConstructor) return;
        // push later based on more confidence; we still record.
      }
    },
    Identifier(node) {
      if (node.name === "tx") {
        // tx.origin is represented as MemberAccess(tx, origin) usually; keep for context.
      }
    },
    MemberAccess(node) {
      // tx.origin
      if (node.memberName === "origin" && isIdentifier(node.expression, "tx")) {
        usesTxOrigin = true;
        push(vulnerabilities, {
          type: "tx-origin-usage",
          severity: "high",
          line: lineOf(node),
          description: "Uses tx.origin for authorization or logic. tx.origin is unsafe for auth due to phishing via intermediate contracts.",
          recommendation: "Use msg.sender for authorization. If necessary, use EIP-2771 trusted forwarder patterns.",
        });
      }

      // selfdestruct()
      if (node.memberName === "selfdestruct") {
        usesSelfdestruct = true;
        push(vulnerabilities, {
          type: "selfdestruct-usage",
          severity: "critical",
          line: lineOf(node),
          description: "selfdestruct detected. If callable by untrusted users, it can permanently disable the contract.",
          recommendation: "Remove selfdestruct or strictly gate it behind strong access control (Ownable/AccessControl) and timelock.",
        });
      }

      // delegatecall
      if (node.memberName === "delegatecall") {
        usesDelegatecall = true;
        push(vulnerabilities, {
          type: "delegatecall-usage",
          severity: "high",
          line: lineOf(node),
          description: "delegatecall detected. Misuse can lead to storage corruption and complete takeover.",
          recommendation: "Avoid delegatecall where possible. If using proxies, follow OZ proxy patterns and validate target implementations.",
        });
      }
    },
    FunctionCall(node) {
      // Low-level call patterns like address(x).call(...)
      const expr = node.expression;
      if (expr?.type === "MemberAccess" && ["call", "staticcall", "delegatecall"].includes(expr.memberName)) {
        lowLevelCalls.push({ node, member: expr.memberName });
      }

      // "unchecked" blocks are a Solidity statement, but parser marks it as UncheckedStatement.
    },
    UncheckedStatement(node) {
      push(vulnerabilities, {
        type: "unchecked-math",
        severity: "medium",
        line: lineOf(node),
        description: "unchecked block found. Integer underflow/overflow checks are disabled inside unchecked.",
        recommendation: "Use unchecked only when proven safe and after bounds checks; add comments explaining invariants.",
      });
    },
  });

  // Unchecked external calls heuristic:
  // If a low-level call is used as a statement (not assigned / required), it may be unchecked.
  // solidity-parser-antlr AST doesn't easily let us see parent; we do a string heuristic as fallback.
  for (const c of lowLevelCalls) {
    const member = c.member;
    const l = lineOf(c.node);

    // Very rough heuristic: if line contains `.call(` and NOT contains `require(` nor `if (` around it.
    const srcLine = s.split(/\r?\n/)[(l || 1) - 1] || "";
    if (srcLine.includes(`.${member}(`) && !/require\s*\(|assert\s*\(|if\s*\(/.test(srcLine)) {
      push(vulnerabilities, {
        type: "unchecked-external-call",
        severity: "high",
        line: l,
        description: `Low-level ${member} appears to be used without checking the success flag.`,
        recommendation:
          "Capture return values `(bool ok, bytes memory data) = target.call(...); require(ok);` and handle failures explicitly.",
      });
    }
  }

  // Integer overflow/underflow risks: Solidity >=0.8 has checked arithmetic.
  // Heuristic: if pragma <0.8 AND see arithmetic ops.
  const pragma = s.match(/pragma\s+solidity\s+\^?\s*(\d+)\.(\d+)\./i);
  if (pragma) {
    const major = Number(pragma[1]);
    const minor = Number(pragma[2]);
    if (major === 0 && minor < 8 && /[+\-*/]=?/.test(s)) {
      push(vulnerabilities, {
        type: "unchecked-arithmetic-pre-0.8",
        severity: "high",
        line: null,
        description: "Solidity <0.8 does not have built-in overflow/underflow checks.",
        recommendation: "Upgrade to Solidity 0.8+ or use SafeMath consistently (or checked arithmetic libraries).",
      });
    }
  }

  // Missing access control (heuristic)
  if (!hasOnlyOwnerModifier && writesStateInExternalFn) {
    push(vulnerabilities, {
      type: "potential-missing-access-control",
      severity: "medium",
      line: null,
      description:
        "Found external/public state-modifying functions without obvious access-control modifiers. This may be intended, but often indicates missing authorization checks.",
      recommendation:
        "Review state-changing entrypoints and gate privileged actions with Ownable/AccessControl (and tests).",
    });
  }

  // Reentrancy heuristic:
  // If contract uses `.call(` and also writes state in external function.
  if (lowLevelCalls.length && writesStateInExternalFn) {
    push(vulnerabilities, {
      type: "reentrancy-risk",
      severity: "high",
      line: null,
      description:
        "Contract performs low-level external calls and also modifies state in externally callable functions. This is a common precondition for reentrancy.",
      recommendation:
        "Use Checks-Effects-Interactions pattern, add ReentrancyGuard, and write reentrancy tests for critical flows.",
    });
  }

  // Unprotected selfdestruct heuristic: we can only weakly detect access control.
  if (usesSelfdestruct && !hasOnlyOwnerModifier) {
    warnings.push("selfdestruct detected but access control could not be verified reliably via heuristics.");
  }

  if (usesDelegatecall && !/proxy|implementation/i.test(s)) {
    warnings.push("delegatecall detected outside obvious proxy patterns; review carefully.");
  }

  return { vulnerabilities, warnings };
}
