import { createConfig, http, injected } from "wagmi";
import { CHAIN, RPC_URL } from "@/lib/chain";

// wagmi 3 (ARCHITECTURE §12). Browser wallets are found through EIP-6963
// (multiInjectedProviderDiscovery, on by default): MetaMask, Rabby, OKX… each show up by name.
// injected() is the fallback for older wallets that only set window.ethereum.
// Mobile / QR wallets (WalletConnect) need a Reown project id: added when there is one.
// RainbowKit isn't used: its latest release (2.2.11) only supports wagmi 2.
export const wagmiConfig = createConfig({
  chains: [CHAIN],
  connectors: [injected()],
  transports: { [CHAIN.id]: http(RPC_URL) },
  // The server can't know the wallet; the client reconnects after hydration (no mismatch).
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
