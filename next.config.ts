import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone (server.js + minimal node_modules) for the Mac app bundle.
  // See scripts/package-mac.sh.
  output: "standalone",
};

export default nextConfig;
