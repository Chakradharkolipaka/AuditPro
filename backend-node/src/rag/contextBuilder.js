/**
 * contextBuilder
 *
 * Turns retrieved snippets into a compact system-context string.
 */

/**
 * @param {{snippets:Array<{text:string, metadata?:any, distance?:number}>, maxChars?:number}} params
 */
export function buildRagContext({ snippets, maxChars = 6000 }) {
  const safe = Array.isArray(snippets) ? snippets : [];

  let ctx = "Relevant references (RAG):\n";
  for (const [idx, s] of safe.entries()) {
    const title = s?.metadata?.title || s?.metadata?.source || `snippet-${idx + 1}`;
    const dist = typeof s?.distance === "number" ? ` (distance=${s.distance.toFixed(4)})` : "";
    ctx += `\n[${idx + 1}] ${title}${dist}\n${String(s?.text || "").trim()}\n`;
    if (ctx.length > maxChars) break;
  }

  return ctx.slice(0, maxChars);
}
