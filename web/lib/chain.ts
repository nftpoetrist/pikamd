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
  // 2026-10-14 redeploy with setHidden / setModeratorLock; the first deployment (0x8dA7…b4A1) had
  // the delist bug (ARCHITECTURE §5.1) and is abandoned, it holds no guidelines.
  [arcTestnet.id]: { address: "0x27cf926771B0A311A9574543ea29dc5e3ea59986", deployBlock: BigInt(67092487) },
};

/** The registry on the configured network, or undefined where it isn't deployed. */
export const REGISTRY = REGISTRIES[CHAIN.id];

/** USDC's ERC-20 interface: 6 decimals, the same address on Arc testnet and mainnet (ARC.md §3, §8). */
export const USDC = { address: "0x3600000000000000000000000000000000000000", decimals: 6 } as const;

// GuidelineTips deployments (contracts/script/DeployTips.s.sol, ARC.md §8): tips go through it
// straight to the registry's author (K21). Where it isn't deployed the Tip button says so instead
// of sending anything. The indexer reads its Tipped events from deployBlock.
const TIPS_CONTRACTS: Record<number, { address: `0x${string}`; deployBlock: bigint } | undefined> = {
  // 2026-10-18, deployed with our keystore (pikamd-deployer); Sourcify exact match
  [arcTestnet.id]: { address: "0x81a1A7D604f9771472d5eDE0eF8736b7F75F874a", deployBlock: BigInt(67850761) },
};

/** The tips contract on the configured network, or undefined where it isn't deployed. */
export const TIPS = TIPS_CONTRACTS[CHAIN.id];

// GuidelineReviews deployments (contracts/script/DeployReviews.s.sol, ARCHITECTURE §9.5): a
// moderator's approval of one exact version, the "Reviewed" badge. Where it isn't deployed there
// is no badge and no approve button. The indexer reads its events from deployBlock.
const REVIEWS_CONTRACTS: Record<number, { address: `0x${string}`; deployBlock: bigint } | undefined> = {
  // 2026-10-23, deployed with our keystore (pikamd-deployer); Sourcify exact match
  [arcTestnet.id]: { address: "0x050F0556CE4ed9d195670673f580B2a22e3E40A3", deployBlock: BigInt(68707008) },
};

/** The reviews contract on the configured network, or undefined where it isn't deployed. */
export const REVIEWS = REVIEWS_CONTRACTS[CHAIN.id];

/** Optional provider RPC (API key, domain-restricted); falls back to the chain's public RPC. */
export const RPC_URL: string = process.env.NEXT_PUBLIC_ARC_RPC_URL || CHAIN.rpcUrls.default.http[0];
