/** @type {import('next').NextConfig} */

// Safe security headers applied to every response. (A Content-Security-Policy
// is intentionally left out for now — it needs to be tuned against the real
// prod URLs + map tiles before enforcing.)
const securityHeaders = [
  // Force HTTPS for 2 years, including subdomains (ignored on http/localhost).
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Don't allow the site to be embedded in a frame (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Don't let the browser MIME-sniff responses.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak full URLs (which can carry tokens) to other sites.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Allow geolocation (Explore map) for our own origin; disable the rest.
  {
    key: "Permissions-Policy",
    value: "geolocation=(self), camera=(), microphone=(), payment=()",
  },
];

const nextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
