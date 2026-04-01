/**
 * openzeppelinAnalyzer
 *
 * Best-practice checks for common OpenZeppelin security utilities.
 */

/**
 * @param {{source:string}} params
 * @returns {Promise<{openzeppelin:Array<{check:string,status:'pass'|'warn'|'fail',details:string}>}>}
 */
export async function analyzeOpenZeppelin({ source }) {
  const s = String(source || "");
  const openzeppelin = [];

  const has = (re) => re.test(s);
  const add = (check, status, details) => openzeppelin.push({ check, status, details });

  // Ownable / AccessControl
  const usesOwnable = has(/\bOwnable\b/) || has(/import\s+.*Ownable/);
  const usesAccessControl = has(/\bAccessControl\b/) || has(/import\s+.*AccessControl/);

  add(
    "access-control",
    usesOwnable || usesAccessControl ? "pass" : "warn",
    usesOwnable || usesAccessControl
      ? "Detected Ownable/AccessControl usage. Verify privileged functions are gated."
      : "No Ownable/AccessControl detected. Ensure privileged functions are protected."
  );

  // ReentrancyGuard
  const usesRG = has(/\bReentrancyGuard\b/) || has(/nonReentrant/);
  add(
    "reentrancy-guard",
    usesRG ? "pass" : "warn",
    usesRG
      ? "Detected ReentrancyGuard/nonReentrant usage."
      : "No ReentrancyGuard detected. Consider it for functions that perform external calls + state changes."
  );

  // Pausable
  const usesPausable = has(/\bPausable\b/) || has(/\bwhenNotPaused\b|\bwhenPaused\b/);
  add(
    "pausable",
    usesPausable ? "pass" : "warn",
    usesPausable
      ? "Detected Pausable. Ensure only authorized roles can pause/unpause."
      : "No Pausable detected. Consider adding for emergency response (protocols/bridges/tokens)."
  );

  // SafeERC20
  const usesSafeERC20 = has(/\bSafeERC20\b/) || has(/safeTransfer\b|safeTransferFrom\b/);
  const interactsWithERC20 = has(/\bIERC20\b/) || has(/\btransferFrom\b\s*\(/);
  add(
    "safe-erc20",
    interactsWithERC20 ? (usesSafeERC20 ? "pass" : "warn") : "pass",
    interactsWithERC20
      ? usesSafeERC20
        ? "Detected SafeERC20 for token interactions."
        : "Interacts with ERC20 tokens but SafeERC20 not detected. Consider SafeERC20 to handle non-standard returns."
      : "No ERC20 interactions detected."
  );

  // Initialization (upgradeables)
  const upgradeable = /\bUUPS\b|\bUpgradeable\b|\binitialize\b\s*\(/i.test(s);
  if (upgradeable) {
    const hasInitializer = /\binitializer\b|__\w+_init\b/i.test(s);
    add(
      "upgradeable-initialization",
      hasInitializer ? "pass" : "fail",
      hasInitializer
        ? "Upgradeable signals detected and initializer patterns found. Review initializer access control and disableInitializers."
        : "Upgradeable signals detected but initializer patterns not found. Upgradeable contracts must use initializer patterns instead of constructors."
    );
  }

  return { openzeppelin };
}
