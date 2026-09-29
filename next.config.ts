import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: process.env.GITHUB_ACTIONS ? "/membership_order" : "",
  assetPrefix: process.env.GITHUB_ACTIONS ? "/membership_order/" : undefined,
  images: { unoptimized: true },
};

export default nextConfig;
