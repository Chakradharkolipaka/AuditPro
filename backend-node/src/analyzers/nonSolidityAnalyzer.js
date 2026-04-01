function hasAny(s, patterns) {
  return patterns.some((p) => p.test(s));
}

export async function analyzeNonSolidity({ language, source }) {
  const s = String(source || "");
  const lower = s.toLowerCase();

  const vulnerabilities = [];
  const gasIssues = [];
  const recommendations = [];

  if (hasAny(s, [/unsafe/i, /unchecked/i, /raw pointer/i])) {
    vulnerabilities.push({
      type: `${language}-unsafe-memory`,
      severity: "high",
      line: null,
      description: "Unsafe or unchecked memory operations detected.",
      recommendation: "Prefer safe abstractions and add boundary checks.",
      source: language,
    });
  }

  if (hasAny(s, [/panic!/i, /unwrap\(/i, /expect\(/i])) {
    vulnerabilities.push({
      type: `${language}-panic-path`,
      severity: "medium",
      line: null,
      description: "Potential panic-driven control flow detected.",
      recommendation: "Replace panic paths with explicit error handling where possible.",
      source: language,
    });
  }

  if (lower.includes("loop") || lower.includes("for ") || lower.includes("while ")) {
    gasIssues.push({
      line: null,
      problem: "Potentially expensive loops detected.",
      improvement: "Cache repeated lookups and avoid unbounded loops in critical paths.",
      estimatedGasSaving: "Medium",
    });
  }

  recommendations.push(`Run ${language}-specific linters and static analyzers in CI for stronger guarantees.`);

  return {
    tool: `${language}-analyzer`,
    status: "ok",
    vulnerabilities,
    gasIssues,
    recommendations,
    language,
  };
}
