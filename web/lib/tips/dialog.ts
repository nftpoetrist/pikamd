import { useSyncExternalStore } from "react";

// Which guideline the one tip dialog (components/tips/TipDialog.tsx) is open for, so any Tip
// button (cards, the big preview) can open it. Same pattern as the wallet picker (lib/wallet/modal.ts).

export type TipTarget = {
  /** On-chain guideline id (GuidelineRegistry), ≥ 1 */
  id: number;
  title: string;
  /** The author as PikaMd's index has it; checked against Arc before anything is sent */
  author: `0x${string}`;
  authorName: string;
};

/** One opening of the dialog: `seq` changes every time, so each opening starts fresh. */
export type TipRequest = TipTarget & { seq: number };

let request: TipRequest | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const set = (value: TipRequest | null) => {
  request = value;
  listeners.forEach((notify) => notify());
};

export const openTipDialog = (target: TipTarget) => set({ ...target, seq: ++seq });
export const closeTipDialog = () => set(null);

export function useTipRequest(): TipRequest | null {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    () => request,
    () => null,
  );
}
