import { z } from "zod";

import { groqChatCompletion } from "../services/groqService.js";
import { guardrailSystemPrompt, guardrailDisclaimer } from "../services/prompting.js";

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

    const system = {
      role: "system",
      content: guardrailSystemPrompt(contractSource),
    };

    const completion = await groqChatCompletion([system, ...messages]);
    res.json({
      answer: completion,
      disclaimer: guardrailDisclaimer(),
    });
  } catch (err) {
    next(err);
  }
}
