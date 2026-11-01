/**
 * Supabase settings from the environment. The anon key is public by design (row-level security protects the data);
 * the service role key is server-only and is never read here.
 */
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

export function supabaseConfigured() {
  return /^https:\/\/\S+$/.test(supabaseUrl) && supabaseAnonKey.length > 20;
}

/** Names of the settings that still need a value, for the "not connected yet" screen. Never returns values. */
export function missingSupabaseSettings() {
  return [
    ...(/^https:\/\/\S+$/.test(supabaseUrl) ? [] : ["NEXT_PUBLIC_SUPABASE_URL"]),
    ...(supabaseAnonKey.length > 20 ? [] : ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]),
  ];
}

/** A post-sign-in destination limited to this site ("/app/…"), so a crafted link cannot send people elsewhere. */
export function safeNextPath(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") && !/\s/.test(next) ? next : "/app";
}

export const INDUSTRIES = [
  { key: "manufacturing", label: "Manufacturing", hint: "Parts, drawings, production, shop floor, quality" },
  { key: "commerce", label: "E-commerce / wholesale", hint: "Products and variants, warehouses, fulfilment, returns" },
  { key: "saas", label: "Software / SaaS", hint: "Plans, subscriptions, recurring invoices, MRR, support" },
] as const;
export type Industry = (typeof INDUSTRIES)[number]["key"];
export const industryLabel = (key: string) => INDUSTRIES.find((item) => item.key === key)?.label ?? key;
