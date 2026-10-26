import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.BOH_DIST_DIR ?? process.env.PROTEUS_DIST_DIR ?? ".next",
  cacheComponents: true,
  partialPrefetching: true,
  async redirects() {
    return [
      { source: "/product", destination: "/#how-it-works", permanent: false },
      { source: "/about", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
