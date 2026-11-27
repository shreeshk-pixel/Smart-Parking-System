// Security headers for every page and API response, plus build settings.
// jspdf is loaded from node_modules at runtime (not bundled), which is what its Node build expects.
const dev = process.env.NODE_ENV !== "production";

// Content-Security-Policy: scripts, styles, fonts and API calls only from this site; map tiles from
// OpenStreetMap; QR codes are data: images; the camera scanner uses blob: URLs. No other site may put
// this app in a frame (clickjacking). 'unsafe-inline' is needed by the statically generated Next.js pages.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
];

const nextConfig = {
  poweredByHeader: false,            // no "X-Powered-By: Next.js"
  productionBrowserSourceMaps: false, // never publish source maps (this is the default; kept explicit)
  serverExternalPackages: ["jspdf", "jspdf-autotable"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};
export default nextConfig;
