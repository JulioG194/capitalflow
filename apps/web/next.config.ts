import type { NextConfig } from "next";

/**
 * Upstream Nest API for production same-origin proxying (spec 006 cookie
 * fix). Browser calls `/auth/*`, `/portfolio/*`, `/health` on the Vercel
 * host; Next rewrites them to Render so Set-Cookie is host-only on
 * `*.vercel.app` and middleware can see the session-hint cookie.
 *
 * Local dev keeps `NEXT_PUBLIC_API_URL=http://localhost:3001` (direct) —
 * rewrites only apply when `API_UPSTREAM_URL` is set (Vercel Production +
 * Preview).
 */
const apiUpstream = process.env.API_UPSTREAM_URL?.replace(/\/$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    if (!apiUpstream) {
      return [];
    }
    return [
      { source: "/auth/:path*", destination: `${apiUpstream}/auth/:path*` },
      {
        source: "/portfolio/:path*",
        destination: `${apiUpstream}/portfolio/:path*`,
      },
      { source: "/health", destination: `${apiUpstream}/health` },
    ];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
