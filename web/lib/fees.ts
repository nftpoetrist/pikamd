// The fee the site suggests for every transaction it asks a wallet to send (publish, hide, tip,
// moderation). Without a suggestion the wallet picks its own: on Arc testnet MetaMask put a
// 520 gwei tip on a publish (2026-10-25, 0.114 USDC instead of about 0.0045) because a few
// accounts there tip 500–900 gwei, while blocks were 1.5% full on average and never above 15%.
//
// What a transaction costs is base fee + tip; maxFeePerGas is only a ceiling. So the tip is as
// low as inclusion allows and the ceiling leaves room for the base fee to move while the wallet
// waits for a click. Sources (read 2026-10-25):
// - docs.arc.io gas-and-fees: base fee floor 20 gwei, ceiling 20,000 gwei; a 0 gwei tip is
//   accepted; the next block's base fee is in the parent header's extra_data, 8 bytes big-endian.
// - MetaMask core transaction-controller (utils/gas-fees.ts): when a site sends both
//   maxFeePerGas and maxPriorityFeePerGas they are used as they are, unless a remote flag is on
//   for the chain and maxFeePerGas is below MetaMask's "low" estimate (21 gwei on Arc mainnet
//   that day). Twice the base fee stays above it.
// Pure, no imports: tested in fees.test.mjs.

const GWEI = BigInt(1_000_000_000);

/** Arc's protocol floor and ceiling for the base fee (docs.arc.io gas-and-fees). */
export const MIN_BASE_FEE = BigInt(20) * GWEI;
export const MAX_BASE_FEE = BigInt(20_000) * GWEI;

/**
 * Tip when blocks have room: 1 wei, so effectively nothing. Not 0: a wallet may read a zero tip as
 * "not set" and put its own estimate in its place.
 */
export const IDLE_TIP = BigInt(1);

/** A block at least this full means transactions compete for space, so the tip starts to matter. */
export const FULL_BLOCK = 0.9;

/** Blocks of fee history read before each transaction (about 10 seconds on Arc). */
export const HISTORY_BLOCKS = 20;

/** The tip percentile read from each block: what the cheapest transactions in it paid. */
export const TIP_PERCENTILE = 10;

export type BlockFees = { baseFeePerGas: bigint | null; extraData: `0x${string}` };
export type FeeHistory = { gasUsedRatio: readonly number[]; reward?: readonly (readonly bigint[])[] };
export type FeeSuggestion = { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint };

const clampBase = (fee: bigint) => (fee < MIN_BASE_FEE ? MIN_BASE_FEE : fee);

/**
 * The base fee the next block will charge: Arc writes it into the latest block's extra_data
 * (8 bytes, big-endian). A value outside the protocol's range means the field isn't what we expect,
 * so the latest block's own base fee is used instead. Never below the floor.
 */
export function nextBaseFee(block: BlockFees): bigint {
  const hex = block.extraData.slice(2);
  if (hex.length === 16) {
    const announced = BigInt(`0x${hex}`);
    if (announced >= MIN_BASE_FEE && announced <= MAX_BASE_FEE) return announced;
  }
  return clampBase(block.baseFeePerGas ?? MIN_BASE_FEE);
}

/**
 * The lowest tip that still gets into the next block: 1 wei while recent blocks have room (every
 * pending transaction fits, whatever it tips); when some were nearly full, the most that the
 * cheapest transactions in those blocks had to tip.
 */
export function inclusionTip(history: FeeHistory): bigint {
  let tip = IDLE_TIP;
  history.gasUsedRatio.forEach((ratio, i) => {
    if (ratio < FULL_BLOCK) return;
    const paid = history.reward?.[i]?.[0];
    if (paid !== undefined && paid > tip) tip = paid;
  });
  return tip;
}

/** The fee to suggest: the lowest tip that gets in, and room for the base fee to double. */
export function chooseFees(block: BlockFees, history: FeeHistory): FeeSuggestion {
  const base = nextBaseFee(block);
  const tip = inclusionTip(history);
  return { maxFeePerGas: base * BigInt(2) + tip, maxPriorityFeePerGas: tip };
}
