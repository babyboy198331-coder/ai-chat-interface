import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bundles a self-contained Node server (.next/standalone) so the Electron
  // wrapper can run the app's API routes locally instead of needing a
  // static export (which can't serve /api/OpenRouter at all).
  output: "standalone",
};

export default nextConfig;
