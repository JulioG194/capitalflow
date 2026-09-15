import type { Config } from "tailwindcss";

/**
 * Design tokens for the marketing site (CLAUDE.md: "Design tokens live in
 * tailwind.config.ts under theme.extend"). Tailwind v4 is CSS-first by default;
 * this file is loaded via `@config` in `globals.css` so the token source of
 * truth stays a TS config as the project conventions require, while the
 * installed Tailwind v4 pipeline still applies.
 *
 * Colors are chosen to meet WCAG AA contrast (>= 4.5:1) for body text against
 * `background`, and for `brand.600`/`brand.700` used as button/link text on
 * white and vice versa.
 */
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#d9e6ff",
          200: "#b3ccff",
          300: "#82adff",
          400: "#4d84ff",
          500: "#265df5",
          600: "#1a44d6", // primary CTA background, 4.5:1+ on white
          700: "#1636ab", // hover state, AA on white
          800: "#142c85",
          900: "#12275f",
        },
        ink: {
          DEFAULT: "#111827", // body text on white, ~16:1 contrast
          muted: "#4b5563", // secondary text, ~7.5:1 contrast
        },
      },
      borderRadius: {
        card: "0.75rem",
      },
    },
  },
};

export default config;
