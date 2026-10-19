import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  distDir: process.env.PROTEUS_DIST_DIR ?? ".next",
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
