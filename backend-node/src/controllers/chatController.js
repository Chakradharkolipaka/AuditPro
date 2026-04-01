import { z } from "zod";

import { ollamaChat } from "../services/localLLMService.js";
import { guardrailSystemPrompt, guardrailDisclaimer } from "../services/prompting.js";
import { retrieveContexts } from "../rag/retriever.js";
import { buildRagContext } from "../rag/contextBuilder.js";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]).default("user"),
  content: z.string().min(1).max(10_000),
});

const ChatSchema = z.object({
  contractSource: z.string().min(1).max(250_000),
  messages: z.array(MessageSchema).min(1).max(50),
});

export async function chat(req, res, next) {
  try {
    const { contractSource, messages } = ChatSchema.parse(req.body);

    // Retrieve optional knowledge context (RAG). If Chroma isn't running, we degrade gracefully.
    let ragContext = "";
    try {
      const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content || "";
      if (lastUser.trim()) {
        const snippets = await retrieveContexts({ query: lastUser, topK: 4 });
        ragContext = buildRagContext({ snippets });
      }
    } catch (e) {
      // Don't fail chat because vector DB is down.
      ragContext = "";
      console.warn("RAG retrieval skipped:", e?.message || e);
    }

    const system = {
      role: "system",
      content: [
        guardrailSystemPrompt(contractSource),
        ragContext ? "\n\n" + ragContext : "",
      ].join(""),
    };

    const completion = await ollamaChat({ messages: [system, ...messages] });
    res.json({
      answer: completion.content,
      disclaimer: guardrailDisclaimer(),
    });
  } catch (err) {
    next(err);
  }
}
