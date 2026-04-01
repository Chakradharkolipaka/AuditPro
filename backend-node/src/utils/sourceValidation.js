import { validateSoliditySource } from "./solidityValidation.js";

export function validateSourceByLanguage({ source, language }) {
  const s = String(source || "").trim();
  if (!s) return { ok: false, error: "Empty source" };

  if (language === "solidity") {
    return validateSoliditySource(s);
  }

  // Lightweight guard for non-solidity languages (parser plugins can be added later).
  if (s.length < 20) return { ok: false, error: `Source is too short for ${language}` };
  return { ok: true, error: null };
}
