import PageLink from "@/components/PageLink";
import PikaSprite from "@/components/brand/PikaSprite";

// Explore before anyone has shared a guideline (the live site starts empty): an invitation
// instead of empty lanes and a search box with nothing to find.
export default function ExploreEmpty() {
  return (
    <section className="explore-empty pixel-panel" aria-labelledby="explore-empty-title">
      <PikaSprite scale={3} blink className="explore-empty-pika" />
      <h2 id="explore-empty-title" className="explore-empty-title">
        The library is waiting for its <span>first guideline</span>
      </h2>
      <p className="explore-empty-text">
        <span>Share the rules, skills and prompts that make your agent better</span>{" "}
        <span>They show up here for everyone, and every agent can use them over MCP</span>
      </p>
      <div className="explore-empty-actions">
        <PageLink href="/new" className="btn-gold">
          + Publish the first guideline
        </PageLink>
        <PageLink href="/connect" className="btn-ghost">
          Connect your agent
        </PageLink>
      </div>
    </section>
  );
}
