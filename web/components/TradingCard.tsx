import type { ReactNode } from "react";
import { colorPaths } from "@/lib/pixel-path";

// PikaMd feature card: a platform feature presented as a collectible pixel card, in PikaMd's own
// layout: a kicker chip and the name, a stat plaque, the art window, a ribbon banner, then perks
// with a gem bullet and a value, and the card number with a sparkle. Colors come from a theme
// class, e.g. "tcg-violet".

export interface CardPerk {
  name: string;
  value: string;
  text: string;
}

export interface TradingCardProps {
  theme: "violet" | "navy" | "emerald" | "ruby";
  kicker: string;
  name: string;
  stat: string;
  statLabel: string;
  art: ReactNode;
  ribbon: string;
  perks: CardPerk[];
  number: string;
  /** Extra line for the hover title, e.g. a trademark notice. */
  note?: string;
}

// 7×6 pixel gem (flat table on top, pointed below) with an ink outline; the body takes the card's
// stat color, a light facet on the upper left
const GEM = [
  ".OOOOO.",
  "OhhgggO",
  "OgggggO",
  ".OgggO.",
  "..OgO..",
  "...O...",
];

const GEM_FILL: Record<string, string> = { O: "var(--ink)", h: "var(--frame-light)", g: "var(--stat)" };
const GEM_PATHS = colorPaths(GEM.flatMap((row, y) => [...row].flatMap((c, x) => (c === "." ? [] : [{ x, y, fill: GEM_FILL[c] }]))));

function Gem() {
  return (
    <svg className="tcg-gem" width="14" height="12" viewBox="0 0 7 6" shapeRendering="crispEdges" aria-hidden="true">
      {GEM_PATHS.map(({ fill, d }) => (
        <path key={fill} d={d} style={{ fill }} />
      ))}
    </svg>
  );
}

// Four-point pixel sparkle after the card number
function Sparkle() {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor" shapeRendering="crispEdges" aria-hidden="true">
      <path d="M4 0h1v3H4zM3 3h3v1H3zM0 4h9v1H0zM3 5h3v1H3zM4 6h1v3H4z" />
    </svg>
  );
}

export default function TradingCard(props: TradingCardProps) {
  const { theme, kicker, name, stat, statLabel, art, ribbon, perks, number, note } = props;

  return (
    <article className={`tcg tcg-${theme}`} aria-label={`${name}: ${stat} ${statLabel}`} title={note}>
      <div className="tcg-inner">
        <header className="tcg-head">
          <span className="tcg-kicker">{kicker}</span>
          <h3 className="tcg-name">{name}</h3>
          <p className="tcg-plaque">
            <span className="tcg-plaque-value">{stat}</span>
            <span className="tcg-plaque-label">{statLabel}</span>
          </p>
        </header>

        <div className="tcg-art">{art}</div>
        <p className="tcg-ribbon">
          <span>{ribbon}</span>
        </p>

        <div className="tcg-perks">
          {perks.map((perk) => (
            <div key={perk.name} className="tcg-perk">
              <Gem />
              <span className="tcg-perk-name">{perk.name}</span>
              <span className="tcg-perk-value">{perk.value}</span>
              <p className="tcg-perk-text">{perk.text}</p>
            </div>
          ))}
        </div>

        <p className="tcg-number">
          <span>PikaMd</span>
          <span>
            No. {number}
            <Sparkle />
          </span>
        </p>
      </div>
    </article>
  );
}
