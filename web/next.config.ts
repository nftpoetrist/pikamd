import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// The browser only talks to this site and to the Arc RPC (wagmi reads, ARC.md §2). A keyed
// provider in NEXT_PUBLIC_ARC_RPC_URL is allowed too. Fonts are self-hosted by next/font and
// wallet icons are data: URIs (EIP-6963). WalletConnect (lib/wallet/walletconnect.ts) adds what its
// modal was measured to load in headless Chrome, checked against Reown's CSP page
// (docs.reown.com/advanced/security/content-security-policy): the relay, the wallet list API, the
// modal's fonts and the Verify API frame. Not pulse.walletconnect.org: usage analytics only.
const rpcOrigins = ["https://rpc.testnet.arc.io", "https://rpc.mainnet.arc.io"];
if (process.env.NEXT_PUBLIC_ARC_RPC_URL) rpcOrigins.push(new URL(process.env.NEXT_PUBLIC_ARC_RPC_URL).origin);
const walletConnect = {
  connect: ["wss://relay.walletconnect.org", "https://api.web3modal.org"],
  font: ["https://fonts.reown.com"],
  frame: ["https://verify.walletconnect.org"],
};

// CSP without nonces (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md):
// nonces would make every page dynamic. 'unsafe-eval' and ws: only for the dev server.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  `font-src 'self' ${walletConnect.font.join(" ")}`,
  `connect-src 'self' ${[...rpcOrigins, ...walletConnect.connect].join(" ")}${isDev ? " ws:" : ""}`,
  `frame-src ${walletConnect.frame.join(" ")}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // Only honored over HTTPS, so harmless on localhost
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  experimental: {
    // globals.css changes were served stale even after a restart because of the
    // on-disk cache. Keep it off in dev.
    turbopackFileSystemCacheForDev: false,
  },
  // Tailwind now compiles through postcss.config.mjs (@tailwindcss/postcss).
  // The old @tailwindcss/turbopack loader would stop watching the CSS file.
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
