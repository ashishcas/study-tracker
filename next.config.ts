import type { NextConfig } from "next";

// For custom domains on GitHub Pages (e.g. timer.yourdomain.com), basePath is ""
const nextConfig: NextConfig = {
  output: "export",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
