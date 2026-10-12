import PageTransition from "@/components/PageTransition";

// Placeholder for pages that aren't built yet. Because the route exists,
// navbar links open with a soft transition instead of a full page reload.
export default function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <PageTransition>
      <main className="flex flex-1 items-center justify-center px-4 pb-24">
        <section className="pixel-panel w-full max-w-md px-8 py-10 text-center">
          <h1 style={{ fontFamily: "var(--font-jersey)", fontSize: 44, lineHeight: 1, color: "var(--y1)", textShadow: "3px 3px 0 var(--g4)" }}>
            {title}
          </h1>
          <p className="mt-4" style={{ fontFamily: "var(--font-vt323)", fontSize: 22, lineHeight: 1.2, color: "var(--t1)" }}>
            {description}
          </p>
          <p className="mt-6" style={{ fontFamily: "var(--font-vt323)", fontSize: 20, color: "var(--t2)" }}>
            <span className="nav-dot inline-block align-middle" /> COMING SOON
          </p>
        </section>
      </main>
    </PageTransition>
  );
}
