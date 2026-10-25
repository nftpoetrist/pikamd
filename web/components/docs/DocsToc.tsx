"use client";

import { useEffect, useState } from "react";

export type TocGroup = { title: string; items: { id: string; label: string }[] };

// The docs' table of contents: a sticky list beside the text on wide screens, a fold-out list above
// it on phones. The section being read is marked (the last heading that has passed a line near the
// top of the window), so readers always know where they are in a long page.
export default function DocsToc({ groups }: { groups: TocGroup[] }) {
  const ids = groups.flatMap((g) => g.items.map((i) => i.id));
  const [active, setActive] = useState(ids[0]);

  useEffect(() => {
    const headings = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => e !== null);
    const update = () => {
      const line = window.innerHeight * 0.3;
      let current = headings[0]?.id;
      for (const h of headings) if (h.getBoundingClientRect().top <= line) current = h.id;
      setActive(current);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
    // ids only change with the page's sections, which are fixed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = (
    <nav aria-label="On this page" className="docs-toc-nav">
      {groups.map((g) => (
        <div key={g.title} className="docs-toc-group">
          <p className="docs-toc-title">{g.title}</p>
          <ul>
            {g.items.map((i) => (
              <li key={i.id}>
                <a href={`#${i.id}`} className={i.id === active ? "is-active" : undefined} aria-current={i.id === active ? "location" : undefined}>
                  {i.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      <aside className="docs-toc pixel-panel">{list}</aside>
      <details className="docs-toc-mobile pixel-panel">
        <summary>On this page</summary>
        {list}
      </details>
    </>
  );
}
