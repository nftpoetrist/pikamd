import type { Guideline } from "@/lib/types";

// Shared bits of the guideline card and its full-content preview.
export const KIND_LABEL: Record<Guideline["kind"], string> = {
  rules: "RULES",
  skill: "SKILL",
  prompt: "PROMPT",
  agent: "AGENT",
  guide: "GUIDE",
};

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function PixelStar({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 7 7" fill="currentColor" shapeRendering="crispEdges" aria-hidden="true">
      <path d="M3 0h1v1H3zM2 1h3v1H2zM0 2h7v1H0zM1 3h5v1H1zM2 4h3v1H2zM1 5h2v1H1zM4 5h2v1H4zM0 6h2v1H0zM5 6h2v1H5z" />
    </svg>
  );
}

// 7×6 pixel heart, same language as the home page cards.
export function PixelHeart({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round((size * 6) / 7)} viewBox="0 0 7 6" fill="currentColor" shapeRendering="crispEdges" aria-hidden="true">
      <path d="M1 0h2v1H1zM4 0h2v1H4zM0 1h7v2H0zM1 3h5v1H1zM2 4h3v1H2zM3 5h1v1H3z" />
    </svg>
  );
}

// 7×7 pixel coin with a slot: PikaGold (K22), 1 per like on your guidelines.
export function PixelGold({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 7 7" fill="currentColor" shapeRendering="crispEdges" aria-hidden="true">
      <path d="M2 0h3v1H2zM1 1h5v1H1zM0 2h3v3H0zM4 2h3v3H4zM1 5h5v1H1zM2 6h3v1H2z" />
    </svg>
  );
}
