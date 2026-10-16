// Tip amounts (K21) in USDC's ERC-20 units: 6 decimals, so 1 USDC = 1,000,000 (ARC.md §3).
// Amounts are bigints from the moment they're typed; nothing is ever read back from formatted text
// (ARC.md §11, #13). Pure, so it runs in tests and in the browser.

export const USDC_UNIT = BigInt(1_000_000);

/** GuidelineTips.MIN_TIP: 0.01 USDC. The contract rejects anything smaller. */
export const MIN_TIP = BigInt(10_000);

/** The tip form's ceiling, 1,000 USDC: a guard against typos, not a contract rule. */
export const MAX_TIP = BigInt(1_000) * USDC_UNIT;

/** The amounts offered as one-tap choices. */
export const TIP_PRESETS: readonly bigint[] = [BigInt(1), BigInt(3), BigInt(5)].map((n) => n * USDC_UNIT);

/**
 * Kept back for the network fees of the approval and the tip, paid from the same USDC balance.
 * Measured 2026-10-16: approve ≈ 56,000 gas, tip ≈ 91,000 gas, so ≈ 0.003 USDC at Arc's 20 Gwei
 * floor; wallets set aside about twice that up front. 0.01 USDC leaves room for both.
 */
export const FEE_RESERVE = BigInt(10_000);

/** What someone typed as a tip ("2.5", "2,50", "10") → units, or a message saying what's wrong. */
export function parseTipAmount(input: string): { units: bigint } | { error: string } {
  const text = input.trim().replace(",", ".");
  if (text === "") return { error: "Enter an amount" };
  const match = /^(\d{0,4})(?:\.(\d{0,2}))?$/.exec(text);
  if (!match || (match[1] === "" && !match[2])) return { error: "Use a number with up to 2 decimals, like 2.50" };
  const whole = BigInt(match[1] || "0");
  const cents = BigInt((match[2] ?? "").padEnd(2, "0"));
  const units = whole * USDC_UNIT + cents * BigInt(10_000);
  if (units < MIN_TIP) return { error: "The smallest tip is 0.01 USDC" };
  if (units > MAX_TIP) return { error: "Tips here go up to 1,000 USDC" };
  return { units };
}

/**
 * Units → text: whole amounts without decimals ("5", "1,250"), others with at least 2 and at most
 * 6 ("2.50", "0.01", "1.234567"). Exact: no floating point anywhere.
 */
export function formatUsdc(units: bigint): string {
  const negative = units < BigInt(0);
  const abs = negative ? -units : units;
  const whole = (abs / USDC_UNIT).toLocaleString("en-US");
  let frac = (abs % USDC_UNIT).toString().padStart(6, "0").replace(/0+$/, "");
  if (frac !== "" && frac.length < 2) frac = frac.padEnd(2, "0");
  return `${negative ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`;
}
