"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/app/app/actions";
import { createHash } from "node:crypto";
import { parseSpec } from "@/lib/erp/model";
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

/** SHA-256 of a stored object, computed on the server from the bytes in Storage (never trusted from the browser). */
async function storedSha256(supabase: Awaited<ReturnType<typeof session>>, path: string) {
  const { data, error } = await supabase.storage.from("company-files").download(path);
  if (error || !data) return null;
  return createHash("sha256").update(Buffer.from(await data.arrayBuffer())).digest("hex");
}

/**
 * Adds a drawing version for review. The file is required: the browser uploads it to a new path (never overwriting),
 * the server hashes the stored bytes, and that fingerprint is recorded. A changed file is a new version and a new record.
 */
export async function addDrawingAction(_: FormState, form: FormData): Promise<FormState> {
  const companyId = id(form, "companyId");
  const partId = id(form, "partId");
  const number = text(form, "number", 40).toUpperCase();
  const revision = text(form, "revision", 8).toUpperCase();
  const path = text(form, "storagePath", 400);
  const browserHash = text(form, "sha256", 64).toLowerCase();
  if (!companyId || !partId || !number || !/^[A-Z0-9]{1,8}$/.test(revision)) return { error: "Choose the part and enter drawing number and revision." };
  if (!path.startsWith(`${companyId}/drawings/`)) return { error: "Choose the drawing file. A drawing can only be approved with its file." };
  const supabase = await session();
  const serverHash = await storedSha256(supabase, path);
  if (!serverHash) return { error: "The uploaded file could not be read back. Upload it again." };
  if (browserHash && browserHash !== serverHash) return { error: "The stored file differs from the one you chose. Upload it again." };
  const { error } = await supabase.from("files").insert({
    company_id: companyId, storage_path: path, name: text(form, "fileName", 200) || `${number}_${revision}`,
    mime: text(form, "mime", 120) || "application/octet-stream", size_bytes: Math.max(0, whole(form, "size") || 0),
    doc_type: "Drawing", number, revision, status: "In review", linked_type: "item", linked_id: partId, content_sha256: serverHash,
  });
  return error ? failure(error, "The drawing could not be saved.") : done(`Drawing ${number} rev ${revision} added for review (SHA-256 ${serverHash.slice(0, 12)}…).`);
}

/** Approves a drawing after re-hashing the stored file on the server; the database binds the approval to that fingerprint. */
export async function approveDrawingAction(_: FormState, form: FormData): Promise<FormState> {
  const fileId = id(form, "fileId");
  if (!fileId) return { error: "Something went wrong. Reload the page and try again." };
  const supabase = await session();
  const { data: file } = await supabase.from("files").select("storage_path").eq("id", fileId).maybeSingle();
  if (!file) return { error: "The drawing was not found." };
  const verified = await storedSha256(supabase, file.storage_path);
  if (!verified) return { error: "The stored file could not be read, so it cannot be approved." };
  const { error } = await supabase.rpc("approve_file", { file_id: fileId, verified_sha256: verified });
  return error ? failure(error, "The drawing could not be approved.") : done("Drawing approved. The approval is bound to this exact file.");
}

export async function supersedeDrawingAction(_: FormState, form: FormData): Promise<FormState> {
  const fileId = id(form, "fileId");
  const reason = text(form, "reason", 300);
  if (!fileId || reason.length < 5) return { error: "Give a reason of at least a few words. It is saved with your name." };
  const supabase = await session();
  const { error } = await supabase.rpc("supersede_file", { file_id: fileId, reason });
  return error ? failure(error, "The drawing could not be superseded.") : done("Drawing superseded. The reason is in the activity log.");
}

/**
 * Adds a characteristic to the inspection plan of a part revision (owners and admins). Limits are stored explicitly:
 * typed lower/upper limits win; otherwise the entry helper reads them from the specification. ISO fits are never guessed.
 */
export async function addPlanAction(_: FormState, form: FormData): Promise<FormState> {
  const companyId = id(form, "companyId");
  const partId = id(form, "partId");
  const revision = text(form, "revision", 8).toUpperCase();
  const characteristic = text(form, "characteristic", 80);
  const kind = text(form, "kind", 10) === "attribute" ? "attribute" : "numeric";
  const spec = text(form, "spec", 60);
  const sample = whole(form, "sample") || 1;
  if (!companyId || !partId || !revision || !characteristic || !(sample >= 1)) return { error: "Choose the part, revision and characteristic, and a sample size of 1 or more." };
  const typed = (key: string) => { const raw = text(form, key, 20); return raw === "" ? null : Number(raw.replace(",", ".")); };
  let lower = kind === "numeric" ? typed("lower") : null;
  let upper = kind === "numeric" ? typed("upper") : null;
  let nominal: number | null = null;
  if ((lower !== null && !Number.isFinite(lower)) || (upper !== null && !Number.isFinite(upper))) return { error: "Limits must be numbers." };
  if (kind === "numeric" && lower === null && upper === null && spec) {
    const parsed = parseSpec(spec);
    if (parsed) ({ lower, upper, nominal } = parsed);
  }
  const supabase = await session();
  const { error } = await supabase.from("inspection_plans").insert({
    company_id: companyId, item_id: partId, revision, characteristic, kind, nominal, lower_limit: lower, upper_limit: upper,
    unit: text(form, "unit", 10), required_gauge: text(form, "gauge", 40), sample_size: sample, spec_text: spec,
  });
  if (error) return failure(error, "The plan characteristic could not be saved. Only owners and admins edit inspection plans.");
  return done(kind === "numeric" && lower === null && upper === null
    ? `${characteristic} added without usable limits: results will need review. Enter explicit limits to judge them automatically.`
    : `${characteristic} added to the inspection plan.`);
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
  const lot = text(form, "lot", 60);
  const { error } = await supabase.from("stock_moves").insert({ company_id: companyId, item_id: material!.id, warehouse_id: store!.id, quantity, reason: "receipt", note: text(form, "note", 200), lot, certificate: text(form, "certificate", 80) });
  return error ? failure(error, "The receipt could not be booked.") : done(`${quantity} ${unit} ${sku} received${lot ? ` (heat/batch ${lot}; it follows the material to the job)` : ""}.`);
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
  const pin = text(form, "pin", 8);
  const supabase = await session();
  // Your own linked operator needs no PIN; anyone else on a shared terminal confirms with that operator's PIN.
  if (pin) {
    const { data, error } = await supabase.rpc("start_operation_pin", { target_order: orderId, person: personId, op_seq: seq ? Number(seq) : null, pin });
    if (error) return failure(error, "The operation could not start.");
    return data ? done("Operation started.") : { error: "The PIN was not accepted: it is wrong, not set, or locked for 15 minutes after 5 wrong tries." };
  }
  const { error } = await supabase.rpc("start_operation", { target_order: orderId, person: personId, op_seq: seq ? Number(seq) : null });
  return error ? failure(error, "The operation could not start.") : done("Operation started.");
}

export async function endOperationAction(_: FormState, form: FormData): Promise<FormState> {
  const activeId = id(form, "activeId");
  const good = whole(form, "good");
  const scrap = whole(form, "scrap");
  if (!activeId) return { error: "Something went wrong. Reload the page and try again." };
  if (!(good >= 0) || !(scrap >= 0)) return { error: "Enter whole numbers of 0 or more." };
  const pin = text(form, "pin", 8);
  const supabase = await session();
  const notes = text(form, "notes", 300);
  const { data, error } = pin
    ? await supabase.rpc("end_operation_pin", { active: activeId, good, scrap, notes, pin })
    : await supabase.rpc("end_operation", { active: activeId, good, scrap, notes });
  if (error) return failure(error, "The operation could not be booked.");
  if (pin && data === null) return { error: "The PIN was not accepted: it is wrong, not set, or locked for 15 minutes after 5 wrong tries." };
  return done(data === "Completed" ? "Booked. Every operation is done: the order is completed." : "Booked.");
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

/** Records one result per plan characteristic. The specification and limits come from the server-stored plan. */
export async function recordInspectionAction(_: FormState, form: FormData): Promise<FormState> {
  const orderId = id(form, "orderId");
  if (!orderId) return { error: "Something went wrong. Reload the page and try again." };
  const planIds = form.getAll("planId").map(String).filter((value) => UUID.test(value));
  if (!planIds.length) return { error: "This part revision has no inspection plan yet." };
  const rows = planIds.map((planId) => ({
    plan_id: planId, observed: text(form, `observed-${planId}`, 40), result: text(form, `result-${planId}`, 4),
    sample_size: whole(form, `sample-${planId}`) || 0, gauge_id: text(form, `gauge-${planId}`, 40),
  }));
  const supabase = await session();
  const { data, error } = await supabase.rpc("record_inspection", { target_order: orderId, results: rows });
  return error ? failure(error, "The inspection could not be recorded.") : done(data ? "Inspection recorded: passed." : "Inspection recorded: not passed. Failed results block dispatch; results that need review wait for an owner or admin.");
}

export async function resolveReviewAction(_: FormState, form: FormData): Promise<FormState> {
  const inspectionId = Number(text(form, "inspectionId", 20));
  const decision = text(form, "decision", 4);
  const reason = text(form, "reason", 300);
  if (!Number.isInteger(inspectionId) || !["pass", "fail"].includes(decision)) return { error: "Choose pass or fail." };
  if (reason.length < 5) return { error: "Give a reason of at least a few words." };
  const supabase = await session();
  const { error } = await supabase.rpc("resolve_inspection", { inspection_id: inspectionId, decision, reason });
  return error ? failure(error, "The review could not be resolved.") : done(`Review resolved as ${decision}. The original result is kept.`);
}

/* ---------- Owner and admin controls (each enforced again by the database) ---------- */

export async function adjustStockAction(_: FormState, form: FormData): Promise<FormState> {
  const itemId = id(form, "itemId");
  const amount = decimal(form, "amount");
  const reason = text(form, "reason", 300);
  if (!itemId || !Number.isFinite(amount) || amount === 0) return { error: "Choose the material and a quantity to add (positive) or remove (negative)." };
  if (reason.length < 5) return { error: "Give a reason of at least a few words." };
  const supabase = await session();
  const { data: store } = await supabase.from("warehouses").select("id").eq("company_id", text(form, "companyId", 40)).eq("code", "MAIN").maybeSingle();
  if (!store) return { error: "There is no main store yet." };
  const { error } = await supabase.rpc("adjust_stock", { target_item: itemId, target_warehouse: store.id, amount, reason });
  return error ? failure(error, "The adjustment was not booked.") : done("Stock adjusted. The reason is in the activity and audit history.");
}

export async function changeMaterialAction(_: FormState, form: FormData): Promise<FormState> {
  const materialId = id(form, "orderMaterialId");
  const quantity = decimal(form, "quantity");
  const reason = text(form, "reason", 300);
  if (!materialId || !(quantity > 0)) return { error: "Enter the new quantity." };
  if (reason.length < 5) return { error: "Give a reason of at least a few words." };
  const supabase = await session();
  const { error } = await supabase.rpc("change_order_material", { order_material_id: materialId, new_quantity: quantity, reason });
  return error ? failure(error, "The material was not changed.") : done("Material changed; the difference was booked in stock.");
}

export async function correctLotAction(_: FormState, form: FormData): Promise<FormState> {
  const orderId = id(form, "orderId");
  const reason = text(form, "reason", 300);
  if (!orderId) return { error: "Something went wrong. Reload the page and try again." };
  if (reason.length < 5) return { error: "Give a reason of at least a few words." };
  const supabase = await session();
  const { error } = await supabase.rpc("correct_material_lot", { target_order: orderId, material_name: text(form, "material", 120), heat_no: text(form, "heat", 60), certificate_no: text(form, "certificate", 80), reason });
  return error ? failure(error, "The lot was not corrected.") : done("Lot corrected. The old value stays in the audit history.");
}

export async function setPinAction(_: FormState, form: FormData): Promise<FormState> {
  const personId = id(form, "personId");
  const pin = text(form, "pin", 8);
  if (!personId || !/^\d{4,8}$/.test(pin)) return { error: "A PIN has 4 to 8 digits." };
  const supabase = await session();
  const { error } = await supabase.rpc("set_person_pin", { person: personId, pin });
  return error ? failure(error, "The PIN was not set.") : done("PIN set. Tell the operator in person; it is never shown again.");
}

/** Links an operator record to the signed-in owner's or admin's own sign-in (the database refuses anyone else). */
export async function linkMeAction(_: FormState, form: FormData): Promise<FormState> {
  const personId = id(form, "personId");
  if (!personId) return { error: "Something went wrong. Reload the page and try again." };
  const { supabase, user } = await currentUser();
  if (!user) redirect("/app/login");
  const { error } = await supabase.from("people").update({ user_id: user.id }).eq("id", personId);
  return error ? failure(error, "The sign-in was not linked. Only owners and admins link people.") : done("Linked to your sign-in: you can book as this operator without a PIN.");
}

/* ---------- Dispatch (P11): the database checks completion, the passed inspection and the drawing again ---------- */

export async function dispatchAction(_: FormState, form: FormData): Promise<FormState> {
  const orderId = id(form, "orderId");
  if (!orderId) return { error: "Something went wrong. Reload the page and try again." };
  const supabase = await session();
  const { data, error } = await supabase.rpc("dispatch_order", { target_order: orderId, note: text(form, "note", 300) });
  return error ? failure(error, "The parts were not dispatched.") : done(`Dispatched with delivery note ${data}.`);
}

export async function releaseDispatchAction(_: FormState, form: FormData): Promise<FormState> {
  const orderId = id(form, "orderId");
  const reason = text(form, "reason", 300);
  if (!orderId) return { error: "Something went wrong. Reload the page and try again." };
  if (reason.length < 5) return { error: "Give a reason of at least a few words. It is saved with your name." };
  const supabase = await session();
  const { error } = await supabase.rpc("release_dispatch", { target_order: orderId, reason });
  return error ? failure(error, "The dispatch was not released.") : done("Dispatch released for the drawing problems shown. The reason is in the activity log.");
}
