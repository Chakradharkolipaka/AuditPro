/**
 * Simple security score (0-100) from vulnerabilities.
 * Weights are heuristic and should evolve as you benchmark accuracy.
 */

const SEV_PENALTY = {
  critical: 25,
  high: 15,
  medium: 7,
  low: 3,
};

export function computeSecurityScore({ vulnerabilities = [] } = {}) {
  let score = 100;

  for (const v of vulnerabilities) {
    const sev = String(v?.severity || "medium").toLowerCase();
    score -= SEV_PENALTY[sev] ?? 7;
  }

  if (score < 0) score = 0;
  if (score > 100) score = 100;

  const grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";

  return { score, grade };
}
