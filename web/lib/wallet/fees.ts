import { getBlock, getFeeHistory } from "wagmi/actions";
import { CHAIN } from "@/lib/chain";
import { chooseFees, HISTORY_BLOCKS, TIP_PERCENTILE, type FeeSuggestion } from "@/lib/fees";
import { wagmiConfig } from "@/lib/wallet/config";

/**
 * Fee fields for the next transaction, read from Arc right before it's sent (lib/fees.ts says why
 * and how). If Arc can't be read, nothing is suggested and the wallet picks as it did before:
 * a transaction that costs more beats one that can't be sent.
 */
export async function suggestedFees(): Promise<FeeSuggestion | Record<string, never>> {
  try {
    const [block, history] = await Promise.all([
      getBlock(wagmiConfig, { chainId: CHAIN.id }),
      getFeeHistory(wagmiConfig, { chainId: CHAIN.id, blockCount: HISTORY_BLOCKS, rewardPercentiles: [TIP_PERCENTILE] }),
    ]);
    return chooseFees(block, history);
  } catch (e) {
    console.warn("Couldn't read Arc's fees, so the wallet picks them", e);
    return {};
  }
}
