/**
 * Legal identity for the Impressum (§ 5 DDG) and privacy notice.
 * Fill in every field before the site is promoted publicly. Empty values render as "To be completed".
 * Values can also be supplied through environment variables so they can be changed in Vercel without a code change.
 */
export const legal = {
  companyName: process.env.NEXT_PUBLIC_LEGAL_COMPANY ?? "",
  legalForm: process.env.NEXT_PUBLIC_LEGAL_FORM ?? "",
  representative: process.env.NEXT_PUBLIC_LEGAL_REPRESENTATIVE ?? "",
  street: process.env.NEXT_PUBLIC_LEGAL_STREET ?? "",
  postalCity: process.env.NEXT_PUBLIC_LEGAL_POSTAL_CITY ?? "",
  country: process.env.NEXT_PUBLIC_LEGAL_COUNTRY ?? "Germany",
  email: process.env.NEXT_PUBLIC_LEGAL_EMAIL || process.env.NEXT_PUBLIC_CONTACT_EMAIL || "erpboh@gmail.com",
  phone: process.env.NEXT_PUBLIC_LEGAL_PHONE ?? "",
  register: process.env.NEXT_PUBLIC_LEGAL_REGISTER ?? "",
  vatId: process.env.NEXT_PUBLIC_LEGAL_VAT_ID ?? "",
} as const;

/** Confirmed by the founder (2026-11): shown on the Impressum and the homepage. Legal form, address, register and VAT are still to be confirmed. */
export const founder = { name: "Gourav Mehta", role: "Founder of BOH ERP" } as const;

export const legalComplete = Boolean(legal.companyName && legal.representative && legal.street && legal.postalCity && legal.email);
