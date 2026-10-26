import type { Metadata } from "next";
import { siteConfig } from "@/lib/site-config";

export function pageMetadata(title: string, description: string, pathname: string, options: { indexable?: boolean } = {}): Metadata {
  const url = siteConfig.publicUrl ? `${siteConfig.publicUrl}${pathname}` : undefined;
  const image = siteConfig.publicUrl ? `${siteConfig.publicUrl}/opengraph-image` : undefined;
  const index = siteConfig.indexingEnabled && options.indexable !== false;
  return {
    title,
    description,
    robots: { index, follow: index },
    ...(url ? { alternates: { canonical: url } } : {}),
    ...(url && image ? {
      openGraph: { type: "website", siteName: "BOH ERP", title, description, url, images: [{ url: image, width: 1200, height: 630, alt: "BOH ERP configurable business software" }] },
      twitter: { card: "summary_large_image", title, description, images: [{ url: image, alt: "BOH ERP configurable business software" }] },
    } : {}),
  };
}
