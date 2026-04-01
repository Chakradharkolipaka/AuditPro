const SUPPORTED_LANGUAGES = {
  ".sol": "solidity",
  ".rs": "rust",
  ".move": "move",
  ".mo": "motoko",
  ".fc": "func",
  ".cairo": "cairo",
};

export function detectLanguage(filename) {
  const f = String(filename || "").toLowerCase();
  const ext = Object.keys(SUPPORTED_LANGUAGES).find((k) => f.endsWith(k));
  if (!ext) return { ok: false, language: null, extension: null };
  return { ok: true, language: SUPPORTED_LANGUAGES[ext], extension: ext };
}

export function isSupportedExtension(filename) {
  return detectLanguage(filename).ok;
}

export function supportedExtensions() {
  return Object.keys(SUPPORTED_LANGUAGES);
}
