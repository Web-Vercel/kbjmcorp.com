import type { NextConfig } from "next";
const config: NextConfig = { poweredByHeader: false, async headers() { return [{ source: "/:locale/auth/recovery", headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "Cache-Control", value: "private, no-store, max-age=0" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] }]; }, experimental: { globalNotFound: true } };
export default config;
