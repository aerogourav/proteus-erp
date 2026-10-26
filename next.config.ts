import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.BOH_DIST_DIR ?? process.env.PROTEUS_DIST_DIR ?? ".next",
  cacheComponents: true,
  partialPrefetching: true,
  async redirects() {
    return [
      { source: "/product", destination: "/#how-it-works", permanent: false },
      { source: "/about", destination: "/", permanent: false },
      // The earlier demo workspace now lives under /demo/classic.
      { source: "/demo/new", destination: "/demo", permanent: false },
      ...["journey", "suppliers", "workflows", "activity", "community"].map((path) => ({ source: `/demo/${path}`, destination: `/demo/classic/${path}`, permanent: false })),
      ...["parts", "documents", "production", "crm"].map((path) => ({ source: `/demo/${path}/:id`, destination: `/demo/classic/${path}/:id`, permanent: false })),
    ];
  },
};

export default nextConfig;
