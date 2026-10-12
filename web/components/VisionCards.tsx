import PixelArcLogo from "@/components/PixelArcLogo";
import PixelCoin from "@/components/PixelCoin";
import PixelHeart from "@/components/PixelHeart";
import TradingCard from "@/components/TradingCard";

// "Why PikaMd" — platform features as a row of compact pixel trading cards.
// 001: zero platform fees (honest: PikaMd takes no cut, publishing still pays Arc gas).
// 002: built on Arc — facts from ARC.md (~0.5s blocks, deterministic finality, USDC gas).
// 003: tips — USDC goes wallet to wallet to the author, PikaMd takes 0% (ARCHITECTURE.md K21).
export default function VisionCards() {
  return (
    <section className="tcg-row" aria-label="Why PikaMd">
      <TradingCard
        theme="purple"
        stage="Basic"
        name="Platform Fee"
        stat="0%"
        statLabel="Fee"
        art={
          <div className="tcg-coin">
            <PixelCoin size={56} />
          </div>
        }
        strip="Owned by the community"
        moves={[
          { cost: 1, name: "Free to Use", value: "0", text: "Read, collect and connect." },
          { cost: 2, name: "Publish", value: "<1¢", text: "Only Arc gas. None goes to us." },
        ]}
        number="001"
      />
      <TradingCard
        theme="arc"
        stage="Native"
        name="Built on Arc"
        stat="0.5s"
        statLabel="Block"
        art={
          <div className="tcg-chain">
            <PixelArcLogo scale={3} />
          </div>
        }
        strip="Native Arc dApp"
        moves={[
          { cost: 1, name: "Instant Final", value: "1", text: "One confirmation is final." },
          { cost: 2, name: "Stable Gas", value: "USDC", text: "Gas in USDC." },
        ]}
        number="002"
      />
      <TradingCard
        theme="green"
        stage="Support"
        name="Tip Authors"
        stat="100%"
        statLabel="Author"
        art={
          <div className="tcg-heart">
            <PixelHeart scale={6} />
          </div>
        }
        strip="Wallet to wallet on Arc"
        moves={[
          { cost: 1, name: "Send a Tip", value: "USDC", text: "Thank authors whose files help." },
          { cost: 2, name: "Direct Payout", value: "0%", text: "Wallet to wallet. No middleman." },
        ]}
        number="003"
      />
    </section>
  );
}
