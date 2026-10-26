import type { CSSProperties } from "react";
import MdCard from "@/components/MdCard";
import type { GuidelineCard } from "@/lib/types";

type Direction = "left" | "right";

// Endless lanes of cards, sized to how many guidelines there are (user request 2026-10-26: flow
// with fewer guidelines, and look right doing it):
//   1–3 cards  a centered shelf: one to three cards circling would look odd
//   4–7        one lane with every card
//   8+         two lanes (right→left, left→right), cards dealt round-robin so each gets a mix
// A lane renders its cards several times and slides by exactly one copy, so the loop is seamless.
// It needs enough copies that the rest still covers the widest screen while one copy slides out:
// (copies − 1) × copy width ≥ WIDEST. Pure CSS animation; only the collect buttons are client
// components. The lane moves in whole device pixels on a 50ms clock (globals.css, .md-track): the
// card count sets the distance of one loop.
export const SHELF_BELOW = 4;
const TWO_LANES_FROM = 8;
const CARD_PX = 294; // the widest lane card + gap (globals.css: --card-w 272px + --card-gap 22px)
const WIDEST = 3840; // ultra-wide screens included

const copiesFor = (cards: number) => Math.ceil(WIDEST / (cards * CARD_PX)) + 1;

function Lane({ items, direction }: { items: GuidelineCard[]; direction: Direction }) {
  const copies = copiesFor(items.length);
  const style = { "--lane-cards": items.length } as CSSProperties;
  return (
    <div className={`md-lane md-lane-${direction}`} style={style}>
      <div className="md-track">
        {Array.from({ length: copies }, (_, copy) => (
          // Copies after the first only close the loop: hidden from screen readers and out of the
          // tab order, but still hoverable and clickable (inert would block the mouse).
          <div key={copy} className="md-group" aria-hidden={copy > 0 ? true : undefined}>
            {items.map((g) => (
              <MdCard key={`${copy}-${g.id}`} guideline={g} focusable={copy === 0} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MdLanes({ guidelines }: { guidelines: GuidelineCard[] }) {
  if (guidelines.length < SHELF_BELOW) {
    return (
      <section className="md-shelf" aria-label="Guidelines">
        {guidelines.map((g) => (
          <MdCard key={g.id} guideline={g} />
        ))}
      </section>
    );
  }
  const directions: Direction[] = guidelines.length >= TWO_LANES_FROM ? ["left", "right"] : ["left"];
  // Deal cards round-robin so each lane gets a varied mix.
  const lanes = directions.map((_, i) => guidelines.filter((_, j) => j % directions.length === i));

  return (
    <section className="md-lanes" aria-label="Guideline pool">
      {directions.map((direction, i) => (
        <Lane key={direction} items={lanes[i]} direction={direction} />
      ))}
    </section>
  );
}
