function verifiedHttpsOrigin(value: string | undefined) {
  if (!value?.trim()) return "";
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.origin : "";
  } catch {
    return "";
  }
}

const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() ?? "";
const validContactEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail) ? contactEmail : "";

/** Set only after verifying the public destination and contact address. */
export const siteConfig = {
  contactEmail: validContactEmail,
  publicUrl: verifiedHttpsOrigin(process.env.NEXT_PUBLIC_SITE_URL),
  indexingEnabled: (process.env.BOH_INDEXING_ENABLED ?? process.env.PROTEUS_INDEXING_ENABLED) === "true",
  qrDestination: "",
  /** Vercel Web Analytics (cookie-free page views). Turn on in the Vercel project first, then set NEXT_PUBLIC_VERCEL_ANALYTICS=true. */
  analyticsEnabled: process.env.NEXT_PUBLIC_VERCEL_ANALYTICS === "true",
} as const;
