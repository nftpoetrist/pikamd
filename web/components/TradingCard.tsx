import type { ReactNode } from "react";

// Pixel trading card: a feature of the platform presented as a collectible card.
// Layout follows the classic TCG format (name + stat, art window, moves, stat strip,
// flavor text, card number). Colors come from a theme class, e.g. "tcg-purple".

export interface CardMove {
  cost: number; // number of energy icons
  name: string;
  value: string; // the "damage" column
  text: string;
}

export interface TradingCardProps {
  theme: "purple" | "arc" | "green";
  stage: string;
  name: string;
  stat: string;
  statLabel: string;
  art: ReactNode;
  strip: string;
  moves: CardMove[];
  footer?: { label: string; value: string }[];
  flavor?: string;
  number: string;
}

// Pixel lightning bolt inside a round energy token; token/bolt colors come from the card theme
function Energy() {
  return (
    <svg className="tcg-energy" width="18" height="18" viewBox="0 0 9 9" shapeRendering="crispEdges" aria-hidden="true">
      <path d="M2 0h5v1h1v1h1v5H8v1H7v1H2V8H1V7H0V2h1V1h1z" style={{ fill: "var(--energy-ring)" }} />
      <path d="M2 1h5v1h1v5H7v1H2V7H1V2h1z" style={{ fill: "var(--energy-fill)" }} />
      <path d="M5 2h1v2h1v1H6v1H5v1H4V6h1V5H3V4h1V3h1z" style={{ fill: "var(--energy-bolt)" }} />
    </svg>
  );
}

export default function TradingCard(props: TradingCardProps) {
  const { theme, stage, name, stat, statLabel, art, strip, moves, footer, flavor, number } = props;

  return (
    <article className={`tcg tcg-${theme}`} aria-label={`${name}: ${stat} ${statLabel}`}>
      <div className="tcg-inner">
        <header className="tcg-head">
          <span className="tcg-stage">{stage}</span>
          <h3 className="tcg-name">{name}</h3>
          <p className="tcg-stat">
            <small>{statLabel}</small>
            {stat}
          </p>
          <Energy />
        </header>

        <div className="tcg-art">{art}</div>
        <p className="tcg-strip">{strip}</p>

        <div className="tcg-moves">
          {moves.map((move) => (
            <div key={move.name} className="tcg-move">
              <span className="tcg-cost" aria-label={`Cost ${move.cost}`}>
                {Array.from({ length: move.cost }, (_, i) => (
                  <Energy key={i} />
                ))}
              </span>
              <span className="tcg-move-name">{move.name}</span>
              <span className="tcg-move-value">{move.value}</span>
              <p className="tcg-move-text">{move.text}</p>
            </div>
          ))}
        </div>

        {footer && (
          <dl className="tcg-foot">
            {footer.map(({ label, value }) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}

        {flavor && <p className="tcg-flavor">{flavor}</p>}
        <p className="tcg-number">
          <span>PikaMd</span>
          <span>
            {number}
            <svg width="9" height="9" viewBox="0 0 7 7" fill="currentColor" shapeRendering="crispEdges" aria-hidden="true">
              <path d="M3 0h1v1H3zM2 1h3v1H2zM0 2h7v1H0zM1 3h5v1H1zM2 4h3v1H2zM1 5h2v1H1zM4 5h2v1H4zM0 6h2v1H0zM5 6h2v1H5z" />
            </svg>
          </span>
        </p>
      </div>
    </article>
  );
}
