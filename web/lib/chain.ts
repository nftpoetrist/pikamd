import type { Chain } from "viem";
import { arc, arcTestnet } from "viem/chains";

// Arc network for the whole app (ARC.md §2, verified live 2026-10-12: chain ids 5042002 / 5042).
// Testnet unless NEXT_PUBLIC_ARC_NETWORK=mainnet. viem's arcTestnet still lists the old
// *.arc.network / arcscan.app hosts (ARC.md §6.1), so the official ones override them.
const ARC_TESTNET = {
  ...arcTestnet,
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.io"], webSocket: ["wss://rpc.testnet.arc.io"] },
  },
  blockExplorers: {
    default: { name: "Arc Testnet Explorer", url: "https://explorer.testnet.arc.io", apiUrl: "https://explorer.testnet.arc.io/api" },
  },
} as const;

// Typed as one Chain (not the union of both) so wagmi needs a transport for this chain only.
export const CHAIN: Chain = process.env.NEXT_PUBLIC_ARC_NETWORK === "mainnet" ? arc : ARC_TESTNET;

// GuidelineRegistry deployments (contracts/broadcast, ARC.md §8). Verified on the explorer via
// Sourcify (exact match). The indexer starts from deployBlock. No mainnet deployment yet.
const REGISTRIES: Record<number, { address: `0x${string}`; deployBlock: bigint } | undefined> = {
  [arcTestnet.id]: { address: "0x8dA7825634079ce232141B8EDeD0682557c8b4A1", deployBlock: BigInt(67003886) },
};

/** The registry on the configured network, or undefined where it isn't deployed. */
export const REGISTRY = REGISTRIES[CHAIN.id];

/** Optional provider RPC (API key, domain-restricted); falls back to the chain's public RPC. */
export const RPC_URL: string = process.env.NEXT_PUBLIC_ARC_RPC_URL || CHAIN.rpcUrls.default.http[0];
