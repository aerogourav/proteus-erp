import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  if (!siteConfig.publicUrl || !siteConfig.indexingEnabled) return [];
  return ["/", "/demo", "/tutorials", "/contact"].map((path) => ({
    url: `${siteConfig.publicUrl}${path}`,
    changeFrequency: path === "/" ? "monthly" : "yearly",
    priority: path === "/" ? 1 : 0.5,
  }));
}
