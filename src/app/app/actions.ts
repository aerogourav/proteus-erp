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
  const { data, error } = await supabase.from("contacts")
    .insert({ company_id: companyId, name, email, is_customer: kind !== "supplier", is_supplier: kind !== "customer" })
    .select("id").single();
  if (error || !data) return { error: "The contact could not be saved. You may only have read access to this company." };
  const label = kind === "both" ? "Customer and supplier" : kind === "customer" ? "Customer" : "Supplier";
  await supabase.from("activity_log").insert({ company_id: companyId, module: "contacts", action: "create", entity_type: "contact", entity_id: data.id, summary: `${label} ${name} added` });
  revalidatePath("/app");
  return { ok: `${name} saved.` };
}

export async function signOutAction() {
  const { supabase } = await currentUser();
  await supabase.auth.signOut();
  redirect("/app/login");
}
