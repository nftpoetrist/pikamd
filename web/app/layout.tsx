import type { Metadata } from "next";
import Image from "next/image";
import { Geist, Geist_Mono, Jersey_10, VT323 } from "next/font/google";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import WalletProvider from "@/components/wallet/WalletProvider";
import bgImage from "@/public/bg/pikamd-cards.webp";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "PikaMd",
  description: "Share Markdown guidelines for Claude and other AI agents, save them to your collection, and use them over MCP.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${vt323.variable} ${jersey.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* PikaMd's own card pile (design/brand/background.mjs). Stays fixed during page
            transitions (globals.css → view-transition-name: site-bg) */}
        <div className="scene" aria-hidden="true">
          <div className="bg-strip">
            {/* placeholder="blur": tiny blurred preview until the image loads — no black flash */}
            <Image src={bgImage} alt="" fill preload sizes="100vw" placeholder="blur" />
          </div>
        </div>
        <WalletProvider>
          <Navbar />
          <div className="site-main relative z-10 flex flex-1 flex-col">{children}</div>
          <Footer />
        </WalletProvider>
      </body>
    </html>
  );
}
