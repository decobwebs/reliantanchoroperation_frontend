import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// The local API origin, taken from NEXT_PUBLIC_API_URL rather than hardcoded.
// Port 8000 is occupied by another project on at least one dev machine, so the
// API often runs elsewhere (:8010) — a fixed port here silently blocks every
// login with a CSP violation. Falls back to :8000 so nothing changes for
// anyone already on that port. Dev only; never evaluated in production.
const devApiOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").origin;
  } catch {
    return "http://localhost:8000";
  }
})();

// Origins the browser may call with XHR/fetch/WebSocket. Production is locked to
// Supabase and the deployed API; local development additionally needs the local
// API and the HMR websocket, which would otherwise be blocked.
const connectSrc = [
  "'self'",
  "https://*.supabase.co",
  "https://api.reliantbunkerops.com",
  "https://reliantanchoroperation-backend.onrender.com",
  ...(isDev ? [devApiOrigin, "ws://localhost:3000"] : []),
].join(" ");

// Security headers applied to every response. The backend sets its own headers,
// but those do NOT cover the HTML/asset responses Vercel serves — this closes
// that gap for the custom domain (HTTPS enforcement, clickjacking, MIME sniff, XSS).
const securityHeaders = [
  // Force HTTPS for two years, including subdomains (safe: Vercel is HTTPS-only).
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // This is an internal admin app — never allow it to be framed (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // CSP: frame-ancestors 'none' is the hard clickjacking lock. script/style allow
  // inline because Next.js injects hydration inline; connect-src is limited to the
  // API and Supabase (auth + storage signed URLs). Update the API host if it changes.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      `connect-src ${connectSrc}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
