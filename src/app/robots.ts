import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  const canIndex = Boolean(siteConfig.publicUrl && siteConfig.indexingEnabled);
  return {
    rules: { userAgent: "*", allow: canIndex ? "/" : undefined, disallow: canIndex ? undefined : "/" },
    ...(canIndex ? { sitemap: `${siteConfig.publicUrl}/sitemap.xml` } : {}),
  };
}
