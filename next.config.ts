import type { NextConfig } from "next";
const config: NextConfig = { poweredByHeader: false, experimental: { globalNotFound: true } };
export default config;
