import PixelCoin from "@/components/PixelCoin";
import PixelHeart from "@/components/PixelHeart";
import PixelAgents from "@/components/PixelAgents";
import { PixelBlocks } from "@/components/PixelBlocks";
import TradingCard from "@/components/TradingCard";

// "Why PikaMd" — platform features as a row of compact pixel feature cards.
// 001: zero platform fees (honest: PikaMd takes no cut, publishing still pays Arc gas).
// 002: built on Arc — facts from ARC.md (~0.5s blocks, deterministic finality, USDC gas). Arc's
//      brand rules: "built on Arc" phrasing, "Arc Network" on first reference, no recreated logo
//      (the art is our own pixel blocks), a trademark notice where feasible (the card's title).
// 003: tips — USDC goes wallet to wallet to the author, PikaMd takes 0% (ARCHITECTURE.md K21).
// 004: agents — one key, then any MCP agent reads the collection (K10/K19). Honest scope: MCP
//      agents (Claude Code, Cursor, VS Code, Codex…), not every AI app (claude.ai web needs OAuth).
export const ARC_TRADEMARK = "Arc is a trademark of Circle Internet Group, Inc. and/or its affiliates.";

export default function VisionCards() {
  return (
    <section className="tcg-row" aria-label="Why PikaMd">
      <TradingCard
        theme="violet"
        kicker="Community"
        name="Platform Fee"
        stat="0%"
        statLabel="Fee"
        art={
          <div className="tcg-coin">
            <PixelCoin size={56} />
          </div>
        }
        ribbon="Owned by the community"
        perks={[
          { name: "Free to Use", value: "0", text: "Read, collect and connect." },
          { name: "Publish", value: "<1¢", text: "Only Arc gas. None goes to us." },
        ]}
        number="001"
      />
      <TradingCard
        theme="navy"
        kicker="Network"
        name="Built on Arc"
        stat="0.5s"
        statLabel="Blocks"
        art={
          <div className="tcg-blocks">
            <PixelBlocks scale={3} />
          </div>
        }
        ribbon="Recorded on Arc Network"
        perks={[
          { name: "Instant Final", value: "1", text: "One confirmation is final." },
          { name: "Stable Gas", value: "USDC", text: "Gas in USDC." },
        ]}
        number="002"
        note={ARC_TRADEMARK}
      />
      <TradingCard
        theme="emerald"
        kicker="Authors"
        name="Tip Authors"
        stat="100%"
        statLabel="To author"
        art={
          <div className="tcg-heart">
            <PixelHeart scale={6} />
          </div>
        }
        ribbon="Wallet to wallet on Arc"
        perks={[
          { name: "Send a Tip", value: "USDC", text: "Thank authors whose files help." },
          { name: "Direct Payout", value: "0%", text: "Wallet to wallet. No middleman." },
        ]}
        number="003"
      />
      <TradingCard
        theme="ruby"
        kicker="Agents"
        name="Any Agent"
        stat="MCP"
        statLabel="Ready"
        art={
          <div className="tcg-agents">
            <PixelAgents scale={3} />
          </div>
        }
        ribbon="Works with your agent"
        perks={[
          { name: "One Key", value: "1", text: "Connect once, then just ask." },
          { name: "Your Tools", value: "Any", text: "Claude Code, Cursor, Codex…" },
        ]}
        number="004"
      />
    </section>
  );
}
