"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import WalletModal from "@/components/wallet/WalletModal";
import { useSessionFollowsWallet } from "@/lib/wallet/session";
import { wagmiConfig } from "@/lib/wallet/config";

function SessionSync() {
  useSessionFollowsWallet();
  return null;
}

// Wallet + server-state context for the whole site (layout.tsx). One wallet picker for all
// "connect" entry points (navbar, like buttons).
export default function WalletProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <SessionSync />
        {children}
        <WalletModal />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
