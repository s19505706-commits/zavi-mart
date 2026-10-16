import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.100.117"],
  devIndicators: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "static.markaz.app" },
      { protocol: "https", hostname: "**.markaz.app" },
      { protocol: "https", hostname: "markaz.app" }
    ],
    unoptimized: true
  }
};

export default nextConfig;
