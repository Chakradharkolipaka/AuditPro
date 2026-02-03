import { createHash } from "crypto";

export function sha256Hex(input) {
  return createHash("sha256").update(String(input), "utf8").digest("hex");
}
