// Tailwind v4: the standard PostCSS plugin.
// The @tailwindcss/turbopack loader stopped picking up globals.css changes (2026-10-09).
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
