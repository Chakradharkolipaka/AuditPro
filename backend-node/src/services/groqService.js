import fetch from "node-fetch";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function groqChatCompletion(messages) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    const err = new Error("GROQ_API_KEY is not set");
    err.status = 500;
    throw err;
  }

  const model = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

  const resp = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens: 800,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    const err = new Error(`Groq API error: ${resp.status} ${text}`);
    err.status = 502;
    throw err;
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  return content || "(No response)";
}
