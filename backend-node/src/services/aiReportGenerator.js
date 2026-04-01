import { z } from "zod";

import { ollamaChat } from "./localLLMService.js";

const AiReportSchema = z.object({
  executiveSummary: z.string().min(1).max(4000),
  topFindings: z.array(
    z.object({
      title: z.string().min(1).max(200),
      severity: z.enum(["critical", "high", "medium", "low"]),
      rationale: z.string().min(1).max(2000),
      fix: z.string().min(1).max(2000),
    })
  ).max(30),
  testRecommendations: z.array(z.string().min(1).max(500)).max(30),
});

function buildPrompt({ contractName, sourceCode, findings }) {
  return {
    role: "system",
    content: `You are AuditPro, a Solidity security auditing assistant.\n\n` +
      `Return ONLY valid JSON matching this schema (no markdown, no backticks):\n` +
      `{\n` +
      `  "executiveSummary": string,\n` +
      `  "topFindings": [{"title":string,"severity":"critical"|"high"|"medium"|"low","rationale":string,"fix":string}],\n` +
      `  "testRecommendations": [string]\n` +
      `}\n\n` +
      `Contract name: ${contractName}\n\n` +
      `Contract source:\n${sourceCode}\n\n` +
      `Static findings (JSON):\n${JSON.stringify(findings).slice(0, 12000)}\n\n` +
      `Rules:\n- Do not invent vulnerabilities not supported by input.\n- Be concise and actionable.\n- If input is empty, return empty arrays but still valid JSON.`,
  };
}

export async function generateAiRecommendations({ contractName, sourceCode, findings }) {
  const timeoutMs = Number(process.env.AUDIT_TIMEOUT_MS || 20_000);

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const completion = await ollamaChat({
      messages: [buildPrompt({ contractName, sourceCode, findings })],
      temperature: 0.2,
      // localLLMService uses fetch; we pass signal via global fetch in that module only if supported.
    });

    let parsed;
    try {
      parsed = JSON.parse(completion.content);
    } catch {
      // Attempt one repair: ask model to output valid JSON only.
      const repair = await ollamaChat({
        messages: [
          buildPrompt({ contractName, sourceCode, findings }),
          { role: "user", content: `Your last output was invalid JSON. Output ONLY corrected JSON.` },
        ],
        temperature: 0.0,
      });
      parsed = JSON.parse(repair.content);
    }

    return AiReportSchema.parse(parsed);
  } finally {
    clearTimeout(t);
  }
}
