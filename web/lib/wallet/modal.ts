import { useSyncExternalStore } from "react";

// Open/closed state of the one wallet picker (components/wallet/WalletModal.tsx), so any
// button (navbar, like) can open it.
let open = false;
const listeners = new Set<() => void>();
const set = (value: boolean) => {
  open = value;
  listeners.forEach((notify) => notify());
};

export const openWalletModal = () => set(true);
export const closeWalletModal = () => set(false);

export function useWalletModalOpen(): boolean {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    () => open,
    () => false,
  );
}
