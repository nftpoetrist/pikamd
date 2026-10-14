// GuidelineRegistry logs → what the index has to do (ARCHITECTURE §7.4). Pure, so it runs in tests.
// Only logs emitted by the registry's own address count, in chain order (block, then log index).
import { parseEventLogs, type Log } from "viem";
import { REGISTRY_ABI } from "./registry-abi.ts";

export type RegistryAction =
  | { kind: "registered"; id: bigint; author: `0x${string}`; parentId: bigint; cid: string; contentHash: `0x${string}`; license: number; txHash: `0x${string}`; blockNumber: bigint; logIndex: number }
  | { kind: "hidden"; id: bigint; hidden: boolean }
  | { kind: "locked"; id: bigint; locked: boolean }
  | { kind: "version"; id: bigint; version: number };

export function registryActions(logs: Log[], registry: `0x${string}`): RegistryAction[] {
  const own = logs.filter((l) => l.address?.toLowerCase() === registry.toLowerCase());
  const events = parseEventLogs({ abi: REGISTRY_ABI, logs: own, strict: true });
  events.sort((a, b) => (a.blockNumber === b.blockNumber ? (a.logIndex ?? 0) - (b.logIndex ?? 0) : a.blockNumber! < b.blockNumber! ? -1 : 1));
  const out: RegistryAction[] = [];
  for (const e of events) {
    switch (e.eventName) {
      case "GuidelineRegistered":
        out.push({
          kind: "registered", id: e.args.id, author: e.args.author, parentId: e.args.parentId, cid: e.args.cid,
          contentHash: e.args.contentHash, license: e.args.license, txHash: e.transactionHash!, blockNumber: e.blockNumber!, logIndex: e.logIndex ?? 0,
        });
        break;
      case "HiddenSet":
        out.push({ kind: "hidden", id: e.args.id, hidden: e.args.hidden });
        break;
      case "ModeratorLockSet":
        out.push({ kind: "locked", id: e.args.id, locked: e.args.locked });
        break;
      case "VersionPublished":
        if (e.args.version > 1) out.push({ kind: "version", id: e.args.id, version: e.args.version });
        break;
    }
  }
  return out;
}
