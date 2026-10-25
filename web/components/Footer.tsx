import PageLink from "@/components/PageLink";
import { PixelBlock } from "@/components/PixelBlocks";
import { ARC_TRADEMARK } from "@/components/VisionCards";

// Slim full-width bar flush to the bottom of every page (dashed gold line on the top edge, mirroring the navbar).
// Left: wordmark · center: Built on Arc · right: PikaMd on X, Arc on X, PikaMd docs (/docs; the Arc
// docs link moved into PikaMd's docs, 2026-10-25) (navbar button skeleton).
// Arc link verified on arc.io (2026-10-10): x.com/arc.
// PikaMd's X account is @PikaStake for now; the button shows "@pikamd" (user's choice, 2026-10-10).
// Brand rules (checked 2026-10-15): Arc's logo may only be the official file, unaltered, at least
// 50 px tall, so the footer uses the approved words "Built on Arc" with our own pixel block. X's
// logo must keep its form, white on black or black on white, so the X buttons use X's own mark.

// X's logo exactly as x.com serves it (its outline, filled white here; viewBox fitted to the mark)
const X_LOGO =
  "M285.38 207.711L462.954 1.5H420.874L266.687 180.55L143.538 1.5H1.50003L187.726 272.256L1.50003 488.5H43.5818L206.408 299.417L336.462 488.5H478.5L285.37 207.711H285.38ZM227.743 274.641L208.875 247.68L58.7444 33.147H123.379L244.536 206.282L263.405 233.243L420.894 458.292H356.259L227.743 274.652V274.641Z";

// X button in X's own colors (black, white mark) — .btn-x in globals.css
function XButton({ href, label, srLabel }: { href: string; label: string; srLabel: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-x">
      <svg className="footer-x" viewBox="1.5 1.5 477 487" aria-hidden="true">
        <path d={X_LOGO} />
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
        <PageLink href="/" className="footer-brand" aria-label="PikaMd home">
          <span className="logo-text">
            Pika<span>Md</span>
          </span>
          <span className="footer-tag">for the community</span>
        </PageLink>

        <p className="footer-arc" title={ARC_TRADEMARK}>
          <PixelBlock scale={2} />
          <span>
            Built on <span>Arc</span>
          </span>
        </p>

        <div className="footer-right">
          <XButton href="https://x.com/PikaStake" label="@pikamd" srLabel="PikaMd on X" />
          <XButton href="https://x.com/arc" label="@arc" srLabel="Arc on X" />
          <PageLink href="/docs" className="btn-ghost">
            <span className="nav-dot" />
            PikaMd docs
          </PageLink>
        </div>
      </div>
    </footer>
  );
}
