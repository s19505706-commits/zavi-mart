import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.100.117"],
  devIndicators: false,
  images: {
    unoptimized: true
  }
};

export default nextConfig;
