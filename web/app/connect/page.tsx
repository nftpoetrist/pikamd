import type { Metadata } from "next";
import PageTransition from "@/components/PageTransition";
import ConnectPanel from "@/components/connect/ConnectPanel";

export const metadata: Metadata = {
  title: "Connect your agent · PikaMd",
  description: "Connect Claude Code, Cursor, VS Code or Codex to your PikaMd collection over MCP with one key.",
};

// Connect your agent (K19): hero in the same layout as the other pages, then key → prompt → manual setup → try it.
export default function ConnectPage() {
  return (
    <PageTransition>
      <main className="flex flex-1 flex-col">
        <div className="page-center page-center-high hero-compact">
          <h1 className="hero-title">
            Connect your agent
            <br />
            <span>to your library</span>
          </h1>
          <p className="hero-sub">
            <span>Paste one prompt into Claude Code, Cursor, VS Code or Codex</span>{" "}
            <span>Your agent reads your collection over MCP, no downloads</span>
          </p>
          <ConnectPanel />
        </div>
      </main>
    </PageTransition>
  );
}
