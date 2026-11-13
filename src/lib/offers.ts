/**
 * The three free offers shown on the website and chosen in the contact form.
 * One source for the homepage, the form, the inquiry email and the stored lead.
 */
export type OfferKey = "call" | "walkthrough" | "pilot";

export type Offer = {
  key: OfferKey;
  title: string;
  length: string;
  attendees: string;
  youGet: string;
  weNeed: string;
};

export const OFFERS: Offer[] = [
  {
    key: "call",
    title: "Workflow call",
    length: "30 minutes, video or phone",
    attendees: "You, plus whoever runs the workflow day to day",
    youGet: "An honest view of whether BOH ERP fits one workflow you name, and what a pilot would cover",
    weNeed: "A short description of the workflow. A spreadsheet or example helps but isn’t required",
  },
  {
    key: "walkthrough",
    title: "Demo walkthrough",
    length: "45 minutes, screen share",
    attendees: "Your team: owner, planning, shop floor or quality",
    youGet: "A guided tour of the demo following one job from order to invoice, with your questions answered live",
    weNeed: "Which part of the workflow matters most to you, so we can focus on it",
  },
  {
    key: "pilot",
    title: "2-week pilot run",
    length: "2 weeks, one workflow on one production cell",
    attendees: "One owner or manager plus the people who use that cell",
    youGet: "Job release set up for your cell, with release checks, shop-floor booking and inspection, plus a short written result",
    weNeed: "Anonymised or non-confidential job data, one contact person, and about 2 hours of your team’s time in each week",
  },
];

export const PILOT_PLACES = 3;

export const OFFER_KEYS = OFFERS.map((offer) => offer.key);

export function offerByKey(value: unknown): Offer | null {
  return OFFERS.find((offer) => offer.key === value) ?? null;
}

/* ---------- Inquiries ---------- */

export const INQUIRY_LIMITS = { name: 120, email: 200, company: 160, role: 120, message: 4000 } as const;
export type InquiryField = keyof typeof INQUIRY_LIMITS;
export type Inquiry = Record<InquiryField, string> & { offer: OfferKey };

const clean = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/** Validates a submitted inquiry. Returns the cleaned inquiry, or the first problem found. */
export function parseInquiry(payload: Record<string, unknown>): { ok: true; inquiry: Inquiry } | { ok: false; error: string } {
  const data = Object.fromEntries((Object.keys(INQUIRY_LIMITS) as InquiryField[]).map((field) => [field, clean(payload[field], INQUIRY_LIMITS[field])])) as Record<InquiryField, string>;
  const offer = offerByKey(payload.offer);
  if (!offer) return { ok: false, error: "Choose what you would like to start with." };
  if (!data.name || !data.company || !data.message) return { ok: false, error: "Fill in your name, company and workflow." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return { ok: false, error: "Enter a valid email address." };
  return { ok: true, inquiry: { ...data, offer: offer.key } };
}

/** Plain-text body used for the team email and the mailto fallback. */
export function inquiryText(inquiry: Inquiry) {
  return [`Offer: ${offerByKey(inquiry.offer)?.title ?? inquiry.offer}`, `Name: ${inquiry.name}`, `Email: ${inquiry.email}`, `Company: ${inquiry.company}`, `Role: ${inquiry.role || "–"}`, "", "Workflow / problem:", inquiry.message].join("\n");
}
