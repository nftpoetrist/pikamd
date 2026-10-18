import type { CSSProperties } from "react";
import MdCard from "@/components/MdCard";
import type { GuidelineCard } from "@/lib/types";

type Direction = "left" | "right";

// Two endless lanes: right→left, then left→right (from LANES_FROM cards; fewer stand on a shelf).
// Each lane renders its cards twice and slides by exactly one copy (-50%),
// so the loop is seamless. Pure CSS animation; only the collect buttons are client components.
const LANES: { direction: Direction; seconds: number }[] = [
  { direction: "left", seconds: 120 },
  { direction: "right", seconds: 140 },
];

function Lane({ items, direction, seconds }: { items: GuidelineCard[]; direction: Direction; seconds: number }) {
  const style = { "--lane-duration": `${seconds}s` } as CSSProperties;
  return (
    <div className={`md-lane md-lane-${direction}`} style={style}>
      <div className="md-track">
        {[0, 1].map((copy) => (
          // The second copy only exists to close the loop: hidden from screen readers and
          // out of the tab order, but still hoverable and clickable (inert would block the mouse).
          <div key={copy} className="md-group" aria-hidden={copy === 1 ? true : undefined}>
            {items.map((g) => (
              <MdCard key={`${copy}-${g.id}`} guideline={g} focusable={copy === 0} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Below this many cards a lane's copy is narrower than a wide screen (9 cards × 294 px > 2560 px),
 * and the loop would show gaps: the cards stand still on a centered shelf instead.
 */
export const LANES_FROM = 18;

export default function MdLanes({ guidelines }: { guidelines: GuidelineCard[] }) {
  if (guidelines.length < LANES_FROM) {
    return (
      <section className="md-shelf" aria-label="Guidelines">
        {guidelines.map((g) => (
          <MdCard key={g.id} guideline={g} />
        ))}
      </section>
    );
  }
  // Deal cards round-robin so each lane gets a varied mix.
  const lanes = LANES.map((_, i) => guidelines.filter((_, j) => j % LANES.length === i));

  return (
    <section className="md-lanes" aria-label="Guideline pool">
      {LANES.map((lane, i) => (
        <Lane key={i} items={lanes[i]} direction={lane.direction} seconds={lane.seconds} />
      ))}
    </section>
  );
}
