"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import TipDialog from "@/components/tips/TipDialog";
import WalletModal from "@/components/wallet/WalletModal";
import { useMoveLocalCollection } from "@/lib/collection/client";
import { persistQueries } from "@/lib/query-persist";
import { ApiError } from "@/lib/wallet/api";
import { useSessionFollowsWallet } from "@/lib/wallet/session";
import { wagmiConfig } from "@/lib/wallet/config";
import { useRestoreWalletConnect } from "@/lib/wallet/walletconnect";

function SessionSync() {
  useRestoreWalletConnect();
  useSessionFollowsWallet();
  useMoveLocalCollection();
  return null;
}

/**
 * Every query here is a call to this site's functions, which Vercel bills by the second. TanStack
 * Query's defaults (5.104.2) refetch stale queries on every return to the tab and retry a failed
 * call three times, including refusals that can't change (401, 404, 429). Pages still fetch fresh
 * data when they open (refetchOnMount); a query that should follow the tab says so itself.
 */
const QUERY_DEFAULTS = {
  refetchOnWindowFocus: false,
  retry: (failures: number, error: unknown) => failures < 1 && !(error instanceof ApiError && error.status < 500),
} as const;

// Wallet + server-state context for the whole site (layout.tsx). One wallet picker for all
// "connect" entry points (navbar, like buttons) and one tip dialog for every Tip button. Both are
// native modal dialogs: the one opened last (the wallet picker, from the tip dialog) is on top.
export default function WalletProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: QUERY_DEFAULTS } }));
  // A returning visitor's last-known session, collection, PikaGold… right after hydration
  useEffect(() => persistQueries(queryClient), [queryClient]);
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <SessionSync />
        {children}
        <TipDialog />
        <WalletModal />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
