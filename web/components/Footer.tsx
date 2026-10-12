import Link from "next/link";
import PixelArcLogo from "@/components/PixelArcLogo";

// Slim full-width bar flush to the bottom of every page (dashed gold line on the top edge, mirroring the navbar).
// Left: wordmark · center: Build on Arc · right: PikaMd on X, Arc on X, Arc docs (navbar button skeleton).
// Arc links verified on arc.io (2026-10-10): x.com/arc, docs.arc.io.
// PikaMd's X account is @PikaStake for now; the button shows "@pikamd" (user's choice, 2026-10-10).
const X_MARK = [
  "##......#",
  ".##....#.",
  "..##..#..",
  "...###...",
  "....##...",
  "...#.##..",
  "..#...##.",
  ".#.....##",
  "#.......#",
];

// X button in X's own colors (black, white mark) — .btn-x in globals.css
function XButton({ href, label, srLabel }: { href: string; label: string; srLabel: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-x">
      {/* Pixel X mark: thick "\" stroke, thin "/" stroke, like the real logo */}
      <svg className="footer-x" width="18" height="18" viewBox="0 0 9 9" shapeRendering="crispEdges" aria-hidden="true">
        {X_MARK.flatMap((row, y) =>
          [...row].map((c, x) => (c === "#" ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} /> : null)),
        )}
      </svg>
      <span aria-hidden="true">{label}</span>
      <span className="sr-only">{srLabel} (opens in a new tab)</span>
    </a>
  );
}

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-bg" />

      <div className="footer-inner">
        <Link href="/" className="footer-brand" aria-label="PikaMd home">
          <span className="logo-text">
            Pika<span>Md</span>
          </span>
          <span className="footer-tag">for the community</span>
        </Link>

        <p className="footer-arc">
          <PixelArcLogo scale={1} />
          <span>
            Build on <span>Arc</span>
          </span>
        </p>

        <div className="footer-right">
          <XButton href="https://x.com/PikaStake" label="@pikamd" srLabel="PikaMd on X" />
          <XButton href="https://x.com/arc" label="@arc" srLabel="Arc on X" />
          <a href="https://docs.arc.io" target="_blank" rel="noopener noreferrer" className="btn-ghost">
            <span className="nav-dot" />
            Arc docs
            <span aria-hidden="true">↗</span>
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
