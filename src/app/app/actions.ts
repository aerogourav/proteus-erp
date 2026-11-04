"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { INDUSTRIES } from "@/lib/supabase/config";
import { currentUser } from "@/lib/supabase/server";

/**
 * Server actions for the signed-in app. Each one checks the user again; row-level security in the database
 * decides what they may read or change, so a forged company id only ever fails.
 */
export type FormState = { error?: string; ok?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);

export async function createCompanyAction(_previous: FormState, form: FormData): Promise<FormState> {
  const name = text(form, "name", 200);
  const industry = text(form, "industry", 40);
  if (!name || name.length > 160) return { error: "Enter your company name (up to 160 characters)." };
  if (!INDUSTRIES.some((item) => item.key === industry)) return { error: "Choose the industry closest to your business." };
  const { supabase, user } = await currentUser();
  if (!user) redirect("/app/login");
  const { error } = await supabase.rpc("create_company", { company_name: name, company_industry: industry });
  if (error) return { error: "The company could not be created. Please try again." };
  revalidatePath("/app");
  redirect("/app");
}

export async function addContactAction(_previous: FormState, form: FormData): Promise<FormState> {
  const companyId = text(form, "companyId", 40);
  const name = text(form, "name", 200);
  const email = text(form, "email", 200);
  const kind = text(form, "kind", 20);
  if (!UUID.test(companyId)) return { error: "Something went wrong. Reload the page and try again." };
  if (!name) return { error: "Enter a name." };
  if (email && !EMAIL.test(email)) return { error: "That email address doesn’t look right." };
  if (!["customer", "supplier", "both"].includes(kind)) return { error: "Choose customer, supplier or both." };
  const { supabase, user } = await currentUser();
  if (!user) redirect("/app/login");
  // Billing address and tax ID, needed on invoices and for the accounting export.
  const address = { street: text(form, "street", 160), postal_code: text(form, "postalCode", 20), city: text(form, "city", 120), country: text(form, "country", 2).toUpperCase() };
  if (address.country && !/^[A-Z]{2}$/.test(address.country)) return { error: "Use a two-letter country code, for example DE." };
  const taxId = text(form, "taxId", 40).toUpperCase().replace(/\s+/g, "");
  const { data, error } = await supabase.from("contacts")
    .insert({ company_id: companyId, name, email, is_customer: kind !== "supplier", is_supplier: kind !== "customer", address, tax_id: taxId })
    .select("id").single();
  if (error || !data) return { error: "The contact could not be saved. You may only have read access to this company." };
  // The activity entry is written by the database (trigger contacts_activity); clients cannot write activity.
  revalidatePath("/app");
  return { ok: `${name} saved.` };
}

export async function signOutAction() {
  const { supabase } = await currentUser();
  await supabase.auth.signOut();
  redirect("/app/login");
}
