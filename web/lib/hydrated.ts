import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

/**
 * False on the server and during hydration, true after: anything that depends on the browser (the
 * connected wallet, storage) renders exactly what the server rendered first, so hydration matches.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}
