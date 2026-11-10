import PageTransition from "@/components/PageTransition";

// The panel for pages that have nothing to show: the 404 page and the error page (app/error.tsx).
// Its buttons are passed in: links for the 404, "Try again" for an error.
export default function StatusPanel({ code, title, description, children }: { code: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <PageTransition>
      <main className="status-page">
        <section className="status-panel pixel-panel" aria-labelledby="status-title">
          <p className="status-code" aria-hidden="true">{code}</p>
          <h1 id="status-title" className="status-title">{title}</h1>
          <p className="status-text">{description}</p>
          <div className="status-actions">{children}</div>
        </section>
      </main>
    </PageTransition>
  );
}
