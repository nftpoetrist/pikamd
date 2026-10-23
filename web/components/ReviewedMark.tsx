// The "Reviewed" badge (ARCHITECTURE §9.5): a PikaMd moderator read this exact version of the file
// and approved it on Arc. Honest about what that means: a review lowers the risk, it isn't a
// guarantee. Shown under the type badge on cards and previews, and in a guideline's header.
export const REVIEWED_NOTE =
  "Reviewed: a PikaMd moderator read this exact version and approved it on Arc. A review lowers the risk; it isn't a guarantee";

export default function ReviewedMark({ size = "card" }: { size?: "card" | "page" }) {
  return (
    <span className={`md-reviewed is-${size}`} title={REVIEWED_NOTE} aria-label={REVIEWED_NOTE} role="img">
      {/* 8×7 pixel check at a whole-number scale (2× on cards, 3× on the page), so its edges stay sharp */}
      <svg width={size === "page" ? 24 : 16} height={size === "page" ? 21 : 14} viewBox="0 0 8 7" fill="currentColor" shapeRendering="crispEdges" aria-hidden="true">
        <path d="M7 0h1v2H7zM6 2h1v1H6zM5 3h1v1H5zM0 3h1v1H0zM1 4h1v1H1zM4 4h1v1H4zM2 5h2v1H2z" />
      </svg>
      <span aria-hidden="true">REVIEWED</span>
    </span>
  );
}
