function has(re, source) {
  return re.test(source);
}

export function analyzeContractRules(source) {
  const s = String(source || "");

  /** @type {Array<{id:string,title:string,severity:'low'|'medium'|'high',summary:string,tags:string[]}>} */
  const risks = [];
  /** @type {Array<{title:string,body:string}>} */
  const explanations = [];

  if (has(/pragma\s+solidity\s+\^?0\.7\./i, s)) {
    risks.push({
      id: "old-solidity",
      title: "Older Solidity compiler range",
      severity: "medium",
      summary:
        "Solidity <0.8 doesn’t have built-in overflow checks. Ensure you use SafeMath or upgrade to 0.8+.",
      tags: ["compiler", "overflow"],
    });
  }

  if (has(/\bdelegatecall\b/i, s)) {
    risks.push({
      id: "delegatecall",
      title: "delegatecall usage",
      severity: "high",
      summary:
        "delegatecall executes code in the caller’s storage context. Validate targets and guard upgrades to avoid storage collisions / takeovers.",
      tags: ["proxy", "upgradeability"],
    });
  }

  if (has(/\.call\b/i, s)) {
    risks.push({
      id: "low-level-call",
      title: "Low-level call found",
      severity: "medium",
      summary:
        "Low-level calls can fail silently if return values aren’t checked and can open reentrancy surfaces if followed by state changes.",
      tags: ["external-call", "reentrancy"],
    });
    explanations.push({
      title: "Why external calls are risky",
      body:
        "External calls transfer control to another contract. Prefer checks → effects → interactions, and add reentrancy guards when value transfers are involved.",
    });
  }

  if (has(/\btx\.origin\b/i, s)) {
    risks.push({
      id: "tx-origin",
      title: "tx.origin used for auth",
      severity: "high",
      summary:
        "Using tx.origin for authorization can be bypassed via phishing / intermediate contracts. Prefer msg.sender.",
      tags: ["auth", "phishing"],
    });
  }

  if (has(/\bselfdestruct\b/i, s)) {
    risks.push({
      id: "selfdestruct",
      title: "selfdestruct present",
      severity: "high",
      summary:
        "selfdestruct can permanently remove bytecode and affect integrations. If required, restrict access and consider upgrade patterns.",
      tags: ["lifecycle", "admin"],
    });
  }

  if (!risks.length) {
    risks.push({
      id: "no-obvious-signals",
      title: "No obvious risky patterns found",
      severity: "low",
      summary:
        "Basic heuristics didn’t match common footguns. Still review permissions, external calls, and value flows carefully.",
      tags: ["heuristics"],
    });
  }

  return { risks, explanations };
}
