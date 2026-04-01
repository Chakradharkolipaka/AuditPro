import parser from "solidity-parser-antlr";

export function validateSoliditySource(source) {
  try {
    parser.parse(String(source || ""), { loc: true, range: true });
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e?.message || "Invalid Solidity" };
  }
}
