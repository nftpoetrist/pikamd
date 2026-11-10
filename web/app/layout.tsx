import type { Metadata } from "next";
import { Geist, Geist_Mono, Jersey_10, Silkscreen, VT323 } from "next/font/google";
import Footer from "@/components/Footer";
import NavScrollTop from "@/components/NavScrollTop";
import Navbar from "@/components/Navbar";
import PixelSky from "@/components/PixelSky";
import WalletProvider from "@/components/wallet/WalletProvider";
import "./globals.css";

// Pages are prerendered or render in well under a second; a cap for the ones rendered on request
// (a new guideline's page, /mod) so none can run to the platform's 300 s (ARCHITECTURE §12.1)
export const maxDuration = 15;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Pixel fonts (latin-ext covers extended Latin characters).
// VT323: menu/buttons — most legible at small sizes (C/O, B/G, 5/S stay distinct).
// Jersey 10: logo and large headings.
const vt323 = VT323({
  variable: "--font-vt323",
  weight: "400",
  subsets: ["latin", "latin-ext"],
});

const jersey = Jersey_10({
  variable: "--font-jersey",
  weight: "400",
  subsets: ["latin", "latin-ext"],
});

// Silkscreen: the uppercase, letter-spaced labels of the menu, buttons and section titles
// (the Squeaksy-style skin, DESIGN.md §1.2). Short English labels only, never body text.
const silkscreen = Silkscreen({
  variable: "--font-silk",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PikaMd",
  description: "Share Markdown guidelines for Claude and other AI agents, save them to your collection, and use them over MCP.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${vt323.variable} ${jersey.variable} ${silkscreen.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* A pixel night sky with clouds (components/PixelSky.tsx). Stays fixed during page
            transitions (globals.css → view-transition-name: site-bg) */}
        <PixelSky />
        <WalletProvider>
          <NavScrollTop />
          <Navbar />
          <div className="site-main relative z-10 flex flex-1 flex-col">{children}</div>
          <Footer />
        </WalletProvider>
      </body>
    </html>
  );
}
