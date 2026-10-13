"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useConnection } from "wagmi";
import PikaGoldCoin from "@/components/PikaGoldCoin";
import { useProfile } from "@/lib/likes/client";
import { openWalletModal } from "@/lib/wallet/modal";

const noop = () => () => {};
const NOTE_MS = 2600;
const GAIN_MS = 900;

// Short enough for the navbar box; the exact number stays in the label
const formatGold = (n: number) =>
  n < 10_000
    ? n.toLocaleString("en-US")
    : new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

// Navbar PikaGold box (K22), right of the wallet button. Disconnected: "–", opens the wallet picker.
// Connected: the wallet's PikaGold; a click explains how it's earned. When the number goes up
// (a like on one of your guidelines), the coin hops and a "+N" floats up.
export default function PikaGoldBox() {
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const { address, status } = useConnection();
  const connected = hydrated && status === "connected" && !!address;
  const profile = useProfile(connected ? address : undefined);
  const gold = connected ? profile.data?.pikagold : undefined;

  const [note, setNote] = useState(false);
  const [gain, setGain] = useState<{ n: number; id: number } | null>(null);
  const previous = useRef<{ address?: string; gold?: number }>({});
  const clipId = useId();

  // Hop only when the same wallet's number grows (not on first load or a wallet switch)
  useEffect(() => {
    const before = previous.current;
    previous.current = { address, gold };
    if (gold === undefined || before.address !== address || before.gold === undefined) return;
    if (gold > before.gold) setGain({ n: gold - before.gold, id: Date.now() });
  }, [address, gold]);

  useEffect(() => {
    if (!gain) return;
    const t = window.setTimeout(() => setGain(null), GAIN_MS);
    return () => window.clearTimeout(t);
  }, [gain]);

  useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => setNote(false), NOTE_MS);
    return () => window.clearTimeout(t);
  }, [note]);

  // A failed profile (e.g. 503 before the backend is live) must not look like endless loading
  const failed = connected && gold === undefined && profile.isError;
  const shown = !connected || failed ? "–" : gold === undefined ? "…" : formatGold(gold);
  const label = !connected
    ? "PikaGold: connect a wallet to see yours"
    : failed
      ? "PikaGold isn't available right now"
      : gold === undefined
        ? "PikaGold loading"
        : `${gold.toLocaleString("en-US")} PikaGold`;

  return (
    <span className="pg-wrap">
      <button
        type="button"
        className={gain ? "btn-ghost pg-box is-gain" : "btn-ghost pg-box"}
        aria-label={label}
        title={connected ? label : "Connect a wallet to see your PikaGold"}
        onClick={() => (connected ? setNote((v) => !v) : openWalletModal())}
      >
        <PikaGoldCoin clipId={clipId} />
        <span className="pg-count" aria-hidden="true">
          {shown}
        </span>
      </button>
      {gain && (
        <span key={gain.id} className="pg-gain" aria-hidden="true">
          +{gain.n}
        </span>
      )}
      {note && connected && (
        <span className="md-tip-note pg-note" role="status">
          {failed ? "PikaGold opens with wallet sign-in. Coming soon" : "You earn 1 PikaGold for every like on guidelines you share"}
        </span>
      )}
    </span>
  );
}
