import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // globals.css changes were served stale even after a restart because of the
    // on-disk cache. Keep it off in dev.
    turbopackFileSystemCacheForDev: false,
  },
  // Tailwind now compiles through postcss.config.mjs (@tailwindcss/postcss).
  // The old @tailwindcss/turbopack loader would stop watching the CSS file.
};

export default nextConfig;
