"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/app/app/actions";
import { currentUser } from "@/lib/supabase/server";

/**
 * Job release actions for the signed-in app. Each checks the user, then calls the database: the release gate,
 * quantity limits, completion, overrides and inspections are enforced by SQL functions in
 * supabase/migrations/20261105000000_production.sql (the same rules as src/lib/erp), so no client can skip them.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (form: FormData, key: string, max = 200) => String(form.get(key) ?? "").trim().slice(0, max);
const id = (form: FormData, key: string) => { const value = text(form, key, 40); return UUID.test(value) ? value : null; };
const whole = (form: FormData, key: string) => { const value = Number(text(form, key, 12)); return Number.isInteger(value) ? value : NaN; };
const decimal = (form: FormData, key: string) => Number(text(form, key, 20).replace(",", "."));

/** Database messages raised by the rule functions are written for people; anything else gets a general message. */
function failure(error: { message?: string; code?: string } | null, fallback: string): FormState {
  const message = error?.message ?? "";
  if (!message || error?.code === "42501" || /permission denied|violates row-level security/i.test(message)) return { error: `${fallback} You may only have read access to this company.` };
  if (/duplicate key/i.test(message)) return { error: "That number is already used." };
  return { error: message.charAt(0).toUpperCase() + message.slice(1) };
}

async function session() {
  const { supabase, user } = await currentUser();
  if (!user) redirect("/app/login");
  return supabase;
}

function done(ok: string): FormState {
  revalidatePath("/app/production");
  return { ok };
}

export async function addPartAction(_: FormState, form: FormData): Promise<FormState> {
  const companyId = id(form, "companyId");
  const sku = text(form, "sku", 40).toUpperCase();
  const name = text(form, "name", 160);
  const revision = text(form, "revision", 8).toUpperCase();
  if (!companyId || !sku || !name || !/^[A-Z0-9]{1,8}$/.test(revision)) return { error: "Enter part number, name and revision (letters or digits)." };
  const supabase = await session();
  const { error } = await supabase.from("items").insert({ company_id: companyId, kind: "part", sku, name, revision });
  return error ? failure(error, "The part could not be saved.") : done(`Part ${sku} saved.`);
}

export async function addPersonAction(_: FormState, form: FormData): Promise<FormState> {
  const companyId = id(form, "companyId");
  const code = text(form, "code", 16).toUpperCase();
  const name = text(form, "name", 120);
  if (!companyId || !code || !name) return { error: "Enter an employee ID and a name." };
  const supabase = await session();
  const { error } = await supabase.from("people").insert({ company_id: companyId, code, name });
  return error ? failure(error, "The person could not be saved.") : done(`${name} added.`);
}

export async function addDrawingAction(_: FormState, form: FormData): Promise<FormState> {
  const companyId = id(form, "companyId");
  const partId = id(form, "partId");
  const number = text(form, "number", 40).toUpperCase();
  const revision = text(form, "revision", 8).toUpperCase();
  const uploaded = text(form, "storagePath", 400);
  if (!companyId || !partId || !number || !/^[A-Z0-9]{1,8}$/.test(revision)) return { error: "Choose the part and enter drawing number and revision." };
  // Without an uploaded file the record still names the drawing; the path stays inside the company's folder.
  const storagePath = uploaded.startsWith(`${companyId}/`) ? uploaded : `${companyId}/drawings/${crypto.randomUUID()}-${number}_${revision}`;
  const supabase = await session();
  const { error } = await supabase.from("files").insert({
    company_id: companyId, storage_path: storagePath, name: text(form, "fileName", 200) || `${number} rev ${revision} (no file attached)`,
    mime: text(form, "mime", 120) || "application/octet-stream", size_bytes: Math.max(0, whole(form, "size") || 0),
    doc_type: "Drawing", number, revision, status: "In review", linked_type: "item", linked_id: partId,
  });
  return error ? failure(error, "The drawing could not be saved.") : done(`Drawing ${number} rev ${revision} added for review.`);
}

export async function approveDrawingAction(_: FormState, form: FormData): Promise<FormState> {
  const fileId = id(form, "fileId");
  if (!fileId) return { error: "Something went wrong. Reload the page and try again." };
  const supabase = await session();
  const { error } = await supabase.rpc("approve_file", { file_id: fileId });
  return error ? failure(error, "The drawing could not be approved.") : done("Drawing approved.");
}

export async function addOperationAction(_: FormState, form: FormData): Promise<FormState> {
  const companyId = id(form, "companyId");
  const partId = id(form, "partId");
  const seq = whole(form, "seq");
  const name = text(form, "name", 80);
  const setup = decimal(form, "setup");
  const run = decimal(form, "run");
  if (!companyId || !partId || !(seq > 0) || !name || !(setup >= 0) || !(run >= 0)) return { error: "Enter operation number, name and times (0 or more)." };
  const supabase = await session();
  const { error } = await supabase.from("routing_operations").insert({ company_id: companyId, item_id: partId, seq, name, work_center: text(form, "workCenter", 20).toUpperCase(), setup_min: setup, run_min_per_pc: run });
  return error ? failure(error, "The operation could not be saved.") : done(`Op ${seq} ${name} added to the routing.`);
}

/** Goods receipt into the main store. Creates the store and the material record the first time. */
export async function receiveMaterialAction(_: FormState, form: FormData): Promise<FormState> {
  const companyId = id(form, "companyId");
  const sku = text(form, "sku", 40).toUpperCase();
  const name = text(form, "name", 160) || sku;
  const unit = text(form, "unit", 8) || "kg";
  const quantity = decimal(form, "quantity");
  if (!companyId || !sku || !(quantity > 0)) return { error: "Enter the material code and a quantity above 0." };
  const supabase = await session();
  let { data: store } = await supabase.from("warehouses").select("id").eq("company_id", companyId).eq("code", "MAIN").maybeSingle();
  if (!store) {
    const created = await supabase.from("warehouses").insert({ company_id: companyId, code: "MAIN", name: "Main store" }).select("id").single();
    if (created.error) return failure(created.error, "The store could not be created.");
    store = created.data;
  }
  let { data: material } = await supabase.from("items").select("id").eq("company_id", companyId).eq("sku", sku).maybeSingle();
  if (!material) {
    const created = await supabase.from("items").insert({ company_id: companyId, kind: "material", sku, name, unit, track_stock: true }).select("id").single();
    if (created.error) return failure(created.error, "The material could not be created.");
    material = created.data;
  }
  const { error } = await supabase.from("stock_moves").insert({ company_id: companyId, item_id: material!.id, warehouse_id: store!.id, quantity, reason: "receipt", note: text(form, "note", 200) });
  return error ? failure(error, "The receipt could not be booked.") : done(`${quantity} ${unit} ${sku} received.`);
}

export async function createOrderAction(_: FormState, form: FormData): Promise<FormState> {
  const companyId = id(form, "companyId");
  const partId = id(form, "partId");
  const materialId = id(form, "materialId");
  const quantity = whole(form, "quantity");
  const materialQty = decimal(form, "materialQty");
  const revision = text(form, "revision", 8).toUpperCase();
  if (!companyId || !partId || !(quantity > 0) || !revision) return { error: "Choose the part and enter revision and a whole quantity above 0." };
  if (!materialId || !(materialQty > 0)) return { error: "Choose the material and the quantity this order needs." };
  const supabase = await session();
  const { data: store } = await supabase.from("warehouses").select("id").eq("company_id", companyId).eq("code", "MAIN").maybeSingle();
  if (!store) return { error: "Receive material into the main store first." };
  const { data: order, error } = await supabase.from("production_orders").insert({ company_id: companyId, item_id: partId, revision, quantity, notes: text(form, "notes", 300) }).select("id, number").single();
  if (error || !order) return failure(error, "The production order could not be created.");
  const material = await supabase.from("order_materials").insert({ company_id: companyId, order_id: order.id, item_id: materialId, warehouse_id: store.id, quantity: materialQty });
  return material.error ? failure(material.error, "The material could not be added to the order.") : done(`Production order ${order.number} created. It starts once the release check is clear.`);
}

export async function setStatusAction(_: FormState, form: FormData): Promise<FormState> {
  const orderId = id(form, "orderId");
  const status = text(form, "status", 20);
  if (!orderId) return { error: "Something went wrong. Reload the page and try again." };
  const supabase = await session();
  const { error } = await supabase.rpc("set_order_status", { target_order: orderId, new_status: status });
  return error ? failure(error, "The status could not change.") : done(`Status set to ${status}.`);
}

export async function overrideAction(_: FormState, form: FormData): Promise<FormState> {
  const orderId = id(form, "orderId");
  const reason = text(form, "reason", 300);
  if (!orderId || reason.length < 5) return { error: "Give a reason of at least a few words. It is saved with your name." };
  const supabase = await session();
  const { error } = await supabase.rpc("override_release", { target_order: orderId, reason });
  return error ? failure(error, "The override was not saved.") : done("Released by override. The reason is in the activity log.");
}

export async function startOperationAction(_: FormState, form: FormData): Promise<FormState> {
  const orderId = id(form, "orderId");
  const personId = id(form, "personId");
  const seq = text(form, "seq", 6);
  if (!orderId) return { error: "Something went wrong. Reload the page and try again." };
  if (!personId) return { error: "Choose who you are first." };
  const supabase = await session();
  const { error } = await supabase.rpc("start_operation", { target_order: orderId, person: personId, op_seq: seq ? Number(seq) : null });
  return error ? failure(error, "The operation could not start.") : done("Operation started.");
}

export async function endOperationAction(_: FormState, form: FormData): Promise<FormState> {
  const activeId = id(form, "activeId");
  const good = whole(form, "good");
  const scrap = whole(form, "scrap");
  if (!activeId) return { error: "Something went wrong. Reload the page and try again." };
  if (!(good >= 0) || !(scrap >= 0)) return { error: "Enter whole numbers of 0 or more." };
  const supabase = await session();
  const { data, error } = await supabase.rpc("end_operation", { active: activeId, good, scrap, notes: text(form, "notes", 300) });
  return error ? failure(error, "The operation could not be booked.") : done(data === "Completed" ? "Booked. Every operation is done: the order is completed." : "Booked.");
}

export async function linkLotAction(_: FormState, form: FormData): Promise<FormState> {
  const companyId = id(form, "companyId");
  const orderId = id(form, "orderId");
  const material = text(form, "material", 120);
  const heat = text(form, "heat", 60);
  if (!companyId || !orderId || !material || !heat) return { error: "Enter the material and its heat number or batch." };
  const supabase = await session();
  const { error } = await supabase.from("material_lots").upsert({ company_id: companyId, order_id: orderId, material, heat, certificate: text(form, "certificate", 80) });
  return error ? failure(error, "The lot could not be linked.") : done(`Heat/batch ${heat} linked.`);
}

export async function recordInspectionAction(_: FormState, form: FormData): Promise<FormState> {
  const orderId = id(form, "orderId");
  if (!orderId) return { error: "Something went wrong. Reload the page and try again." };
  const rows = [0, 1, 2].map((index) => ({
    characteristic: text(form, `characteristic${index}`, 80), spec: text(form, `spec${index}`, 60), unit: text(form, `unit${index}`, 10),
    observed: text(form, `observed${index}`, 40), result: text(form, `result${index}`, 4), sample_size: whole(form, `sample${index}`) || 0, gauge_id: text(form, `gauge${index}`, 40),
  })).filter((row) => row.characteristic || row.observed);
  if (!rows.length) return { error: "Add at least one characteristic with its measured value." };
  const supabase = await session();
  const { data, error } = await supabase.rpc("record_inspection", { target_order: orderId, results: rows });
  return error ? failure(error, "The inspection could not be recorded.") : done(data ? "Inspection recorded: passed." : "Inspection recorded: failed. Values outside the tolerance count as failed.");
}
