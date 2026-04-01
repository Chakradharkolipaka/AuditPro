import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Estimate gas costs via Foundry if available.
 * Falls back gracefully when forge is unavailable.
 */
export async function getGasCost(contractName = "Counter") {
  try {
    const { stdout } = await execFileAsync("forge", ["inspect", contractName, "gas"], {
      timeout: 15_000,
      maxBuffer: 1024 * 1024,
    });

    return {
      deployment: null,
      methodCalls: {
        raw: String(stdout || "").slice(0, 10_000),
      },
      source: "forge-inspect",
    };
  } catch {
    return {
      deployment: null,
      methodCalls: {},
      source: "unavailable",
    };
  }
}
