/**
 * Shop floor: routings, operation start/end per operator, the operation log and KPIs.
 * Pure functions over ErpState, unit-tested with `node --test`.
 */
import {
  DEFAULT_ROUTING, completeOrder, completionBlocker, isProductionComplete, issueMaterial, jobCost, log, logLabourCost, nextId, operationProgress, orderRouting, partNumber,
  releaseGate, revisionLabel, round2, routingFor, touch,
  type Employee, type ErpState, type OpLog, type OperationDef, type OpProgress, type ProductionOrder,
} from "./model.ts";

export { DEFAULT_ROUTING, orderRouting, routingFor };

/* ============================== People ============================== */

export function employeeById(state: ErpState, id: string | null | undefined) {
  return id ? state.employees.find((item) => item.id === id) ?? null : null;
}

export function nextEmployeeCode(state: ErpState) {
  let n = 1001;
  const used = new Set(state.employees.map((item) => item.code.toUpperCase()));
  while (used.has(`E-${n}`)) n += 1;
  return `E-${n}`;
}

export type EmployeeInput = Omit<Employee, "id" | "joinedAt"> & { joinedAt?: string };

export function saveEmployee(state: ErpState, id: string | null, input: EmployeeInput, now: string): ErpState {
  const name = input.name.trim().replace(/\s+/g, " ");
  const code = input.code.trim().toUpperCase();
  if (!name || !/^[A-Z0-9][A-Z0-9-]{1,15}$/.test(code)) return state;
  if (!(input.hourlyRate >= 0) || !(input.monthlySalary >= 0)) return state;
  if (state.employees.some((item) => item.id !== id && item.code.toUpperCase() === code)) return state;
  const record = { code, name, role: input.role.trim(), department: input.department.trim(), email: input.email.trim(), hourlyRate: round2(input.hourlyRate), monthlySalary: round2(input.monthlySalary), pay: input.pay, active: input.active, ...(input.access ? { access: input.access } : {}) };
  if (id) {
    if (!state.employees.some((item) => item.id === id)) return state;
    return log({ ...state, employees: touch(state.employees, id, (item) => ({ ...item, ...record })) }, now, "people", `Employee ${code} ${name} updated`, null);
  }
  const [newId, next] = nextId(state, "emp");
  return log({ ...next, employees: [...next.employees, { id: newId, ...record, joinedAt: input.joinedAt ?? now.slice(0, 10) }] }, now, "people", `Employee ${code} ${name} added`, null);
}

export function setCurrentUser(state: ErpState, employeeId: string | null): ErpState {
  if (employeeId && !state.employees.some((item) => item.id === employeeId)) return state;
  return { ...state, currentUserId: employeeId };
}

/* ============================== Routings ============================== */

export const WORK_CENTERS = ["SAW-01", "LATHE-02", "MILL-03", "DRILL-01", "GRIND-01", "BENCH-01", "HEAT-EXT", "COAT-EXT", "QA-01", "PACK-01"];

/** Operation names offered as a starting point. */
export const OPERATION_LIBRARY: Omit<OperationDef, "seq">[] = [
  { name: "Saw cutting", workCenter: "SAW-01", setupMin: 10, runMinPerPc: 1.5 },
  { name: "CNC turning", workCenter: "LATHE-02", setupMin: 35, runMinPerPc: 4 },
  { name: "CNC milling", workCenter: "MILL-03", setupMin: 45, runMinPerPc: 6 },
  { name: "Drilling and tapping", workCenter: "DRILL-01", setupMin: 15, runMinPerPc: 2 },
  { name: "Grinding", workCenter: "GRIND-01", setupMin: 20, runMinPerPc: 3 },
  { name: "Deburring", workCenter: "BENCH-01", setupMin: 5, runMinPerPc: 1.5 },
  { name: "Heat treatment (external)", workCenter: "HEAT-EXT", setupMin: 0, runMinPerPc: 0.5 },
  { name: "Anodising (external)", workCenter: "COAT-EXT", setupMin: 0, runMinPerPc: 0.5 },
  { name: "In-process inspection", workCenter: "QA-01", setupMin: 5, runMinPerPc: 1 },
  { name: "Final inspection", workCenter: "QA-01", setupMin: 10, runMinPerPc: 1.2 },
  { name: "Washing and packing", workCenter: "PACK-01", setupMin: 5, runMinPerPc: 0.5 },
];

export function hasOwnRouting(state: ErpState, partId: string) {
  return state.routings.some((item) => item.partId === partId);
}

/** Checks a routing; returns an error message or null. */
export function routingError(operations: OperationDef[]): string | null {
  if (!operations.length) return "Add at least one operation.";
  const seqs = new Set<number>();
  for (const op of operations) {
    if (!Number.isInteger(op.seq) || op.seq <= 0) return "Operation numbers must be whole numbers above 0.";
    if (seqs.has(op.seq)) return `Operation ${op.seq} is listed twice.`;
    seqs.add(op.seq);
    if (!op.name.trim()) return `Name operation ${op.seq}.`;
    if (!(op.setupMin >= 0) || !(op.runMinPerPc >= 0)) return `Times for operation ${op.seq} must be 0 or more.`;
  }
  return null;
}

export function saveRouting(state: ErpState, partId: string, operations: OperationDef[], now: string): ErpState {
  if (!state.parts.some((part) => part.id === partId) || routingError(operations)) return state;
  const clean = [...operations].map((op) => ({ seq: op.seq, name: op.name.trim(), workCenter: op.workCenter.trim().toUpperCase(), setupMin: round2(op.setupMin), runMinPerPc: round2(op.runMinPerPc) })).sort((a, b) => a.seq - b.seq);
  const routings = state.routings.some((item) => item.partId === partId)
    ? state.routings.map((item) => item.partId === partId ? { partId, operations: clean } : item)
    : [...state.routings, { partId, operations: clean }];
  return log({ ...state, routings }, now, "parts", `Routing for ${partNumber(state, partId)} saved · ${clean.length} operations`, null);
}

export const plannedMinutes = (op: OperationDef, quantity: number) => round2(op.setupMin + op.runMinPerPc * quantity);

/* ============================== Operations ============================== */

/** done: everything that can arrive is booked; partial: some booked, more to do; next: first one to work on; waiting: nothing has arrived yet. */
export type OpStatus = "done" | "running" | "partial" | "next" | "waiting";
export type OrderOperation = OpProgress & { status: OpStatus; logs: OpLog[]; active: ErpState["activeOps"][number] | null; actives: ErpState["activeOps"]; planned: number };

export function orderOperations(state: ErpState, order: ProductionOrder): OrderOperation[] {
  let nextFound = false;
  return operationProgress(state, order).map((op) => {
    const logs = state.opLogs.filter((entry) => entry.orderId === order.id && entry.seq === op.seq);
    const actives = state.activeOps.filter((item) => item.orderId === order.id && item.seq === op.seq);
    let status: OpStatus;
    if (op.done) status = "done";
    else if (actives.length) status = "running";
    else if (op.booked > 0) status = "partial";
    else if (!nextFound && !isProductionComplete(order.status) && op.remaining > 0) status = "next";
    else status = "waiting";
    if (status !== "done" && status !== "waiting") nextFound = true;
    return { ...op, status, logs, active: actives[0] ?? null, actives, planned: plannedMinutes(op, order.quantity) };
  });
}

/** The operation to work on by default: the first one with parts waiting. Later operations may start on parts already done (split work). */
export function currentOperation(state: ErpState, order: ProductionOrder): OrderOperation | null {
  return orderOperations(state, order).find((op) => !op.done && op.remaining > 0) ?? null;
}

/** Parts that have arrived at an operation so far: good parts of the previous one, or the order quantity. */
export function incomingQuantity(state: ErpState, order: ProductionOrder, seq: number) {
  return operationProgress(state, order).find((op) => op.seq === seq)?.incoming ?? order.quantity;
}

/**
 * Why an operator cannot start work on an order, or null when they can.
 * The release gate applies to every start, so a revised drawing stops further operations.
 * Several operators may work on the same order and operation at once; one person runs one operation at a time.
 */
export function startBlocker(state: ErpState, orderId: string, employeeId: string | null, seq?: number): string | null {
  const order = state.productionOrders.find((item) => item.id === orderId);
  if (!order) return "Production order not found.";
  if (isProductionComplete(order.status)) return `${order.number} is already completed.`;
  if (order.status === "On hold") return `${order.number} is on hold.`;
  const employee = employeeById(state, employeeId);
  if (!employee) return "Choose who you are first.";
  if (!employee.active) return `${employee.name} is marked inactive.`;
  const running = state.activeOps.find((item) => item.employeeId === employee.id);
  if (running) {
    const other = state.productionOrders.find((item) => item.id === running.orderId);
    return `${employee.name} is still running operation ${running.seq} on ${other?.number ?? "another order"}. End it first.`;
  }
  const gate = releaseGate(state, order);
  if (gate) return gate;
  const ops = operationProgress(state, order);
  const op = seq !== undefined ? ops.find((item) => item.seq === seq) : ops.find((item) => !item.done && item.remaining > 0);
  if (!op) return seq !== undefined ? `Operation ${seq} is not on this routing.` : ops.every((item) => item.done) ? "All operations are done." : "No parts are waiting for the next operation yet.";
  if (op.remaining <= 0) return op.done ? `Op ${op.seq} ${op.name} is done.` : `No parts are waiting at Op ${op.seq} ${op.name} yet.`;
  return null;
}

export function startOperation(state: ErpState, orderId: string, employeeId: string, now: string, seq?: number): ErpState {
  if (startBlocker(state, orderId, employeeId, seq)) return state;
  const order = state.productionOrders.find((item) => item.id === orderId)!;
  const ops = operationProgress(state, order);
  const op = (seq !== undefined ? ops.find((item) => item.seq === seq) : ops.find((item) => !item.done && item.remaining > 0))!;
  const employee = employeeById(state, employeeId)!;
  const routing = orderRouting(state, order);
  const [id, base] = nextId(state, "op");
  let next: ErpState = {
    ...base,
    productionOrders: touch(base.productionOrders, orderId, (item) => ({ ...item, routing, status: "Running" })),
    activeOps: [...base.activeOps, { id, orderId, seq: op.seq, employeeId, start: now }],
  };
  next = log(next, now, "shopfloor", `${order.number} · Op ${op.seq} ${op.name} started by ${employee.name} (${employee.code})`, order.projectId);
  return issueMaterial(next, orderId, now);
}

export type EndInput = { qtyGood: number; qtyScrap: number; notes: string };

/** Good + scrap may not exceed the parts still waiting at the operation: those that arrived minus those already booked. */
export function endBlocker(state: ErpState, activeId: string, input: EndInput): string | null {
  const active = state.activeOps.find((item) => item.id === activeId);
  if (!active) return "This operation is not running any more.";
  if (!Number.isInteger(input.qtyGood) || input.qtyGood < 0 || !Number.isInteger(input.qtyScrap) || input.qtyScrap < 0) return "Enter whole numbers of 0 or more.";
  if (input.qtyGood + input.qtyScrap === 0) return "Enter the good and scrap quantity.";
  const order = state.productionOrders.find((item) => item.id === active.orderId);
  const op = order ? operationProgress(state, order).find((item) => item.seq === active.seq) : null;
  if (op && input.qtyGood + input.qtyScrap > op.remaining) return `Only ${op.remaining} part${op.remaining === 1 ? "" : "s"} can be booked at Op ${op.seq}: ${op.incoming} arrived and ${op.booked} ${op.booked === 1 ? "is" : "are"} already booked.`;
  return null;
}

/** Books what one operator did. Partial quantities are fine: the rest is booked later, in another shift or by someone else. */
export function endOperation(state: ErpState, activeId: string, input: EndInput, now: string): ErpState {
  if (endBlocker(state, activeId, input)) return state;
  const active = state.activeOps.find((item) => item.id === activeId)!;
  const order = state.productionOrders.find((item) => item.id === active.orderId);
  if (!order) return { ...state, activeOps: state.activeOps.filter((item) => item.id !== activeId) };
  const routing = orderRouting(state, order);
  const op = routing.find((item) => item.seq === active.seq);
  const employee = employeeById(state, active.employeeId);
  const part = state.parts.find((item) => item.id === order.partId);
  const minutes = Math.max(0.1, Math.round(((Date.parse(now) - Date.parse(active.start)) / 60000) * 10) / 10);
  const [id, base] = nextId(state, "log");
  let next: ErpState = base;
  const entry: OpLog = {
    id, orderId: order.id, orderNumber: order.number, projectId: order.projectId, partId: order.partId, partNumber: part?.number ?? "", revision: revisionLabel(state, order.revisionId), partDescription: part?.description ?? "",
    seq: active.seq, operation: op?.name ?? `Operation ${active.seq}`, workCenter: op?.workCenter ?? "", employeeId: active.employeeId, employeeCode: employee?.code ?? "", employeeName: employee?.name ?? "Unknown",
    start: active.start, end: now, minutes, plannedMinutes: op ? plannedMinutes(op, input.qtyGood + input.qtyScrap) : 0, qtyGood: input.qtyGood, qtyScrap: input.qtyScrap, notes: input.notes.trim().slice(0, 300),
  };
  next = { ...next, activeOps: next.activeOps.filter((item) => item.id !== activeId), opLogs: [...next.opLogs, entry] };
  next = log(next, now, "shopfloor", `${order.number} · Op ${entry.seq} ${entry.operation} ended by ${entry.employeeName}: ${entry.qtyGood} good, ${entry.qtyScrap} scrap, ${entry.minutes} min`, order.projectId);
  return completionBlocker(next, order.id) === null ? completeOrder(next, order.id, now) : next;
}

/**
 * Guided demo shortcut (never in /app): books every remaining operation for the signed-in person, one log entry each, marked
 * synthetic so it is never mistaken for a terminal booking, through the same
 * start/end rules. Refused (nothing changes) while any operation on the order is running or the release gate blocks.
 */
export function recordRemainingOperations(state: ErpState, orderId: string, now: string): ErpState {
  const order = state.productionOrders.find((item) => item.id === orderId);
  const employeeId = state.currentUserId;
  if (!order || !employeeId || isProductionComplete(order.status) || state.activeOps.some((item) => item.orderId === orderId)) return state;
  const open = operationProgress(state, order).filter((op) => !op.done);
  let time = Date.parse(now) - open.reduce((sum, op) => sum + Math.max(1, Math.round(plannedMinutes(op, order.quantity))), 0) * 60000;
  let next = state;
  for (const planned of open) {
    const current = next.productionOrders.find((item) => item.id === orderId)!;
    const op = operationProgress(next, current).find((item) => item.seq === planned.seq)!;
    if (op.done) continue;
    if (op.remaining <= 0) return state;
    const started = startOperation(next, orderId, employeeId, new Date(time).toISOString(), op.seq);
    if (started === next) return state;
    const active = started.activeOps.find((item) => item.orderId === orderId && item.employeeId === employeeId)!;
    time += Math.max(1, Math.round(plannedMinutes(op, op.remaining))) * 60000;
    next = endOperation(started, active.id, { qtyGood: op.remaining, qtyScrap: 0, notes: "Demo shortcut: synthetic booking, not recorded at a terminal" }, new Date(Math.min(time, Date.parse(now))).toISOString());
    const booked = next.opLogs[next.opLogs.length - 1];
    if (booked && booked.orderId === orderId) next = { ...next, opLogs: next.opLogs.map((entry) => entry.id === booked.id ? { ...entry, synthetic: true } : entry) };
  }
  return next;
}

export function cancelOperation(state: ErpState, activeId: string, now: string): ErpState {
  const active = state.activeOps.find((item) => item.id === activeId);
  if (!active) return state;
  const order = state.productionOrders.find((item) => item.id === active.orderId);
  return log({ ...state, activeOps: state.activeOps.filter((item) => item.id !== activeId) }, now, "shopfloor", `${order?.number ?? "Order"} · Op ${active.seq} start cancelled`, order?.projectId ?? null);
}

/* ============================== KPIs ============================== */

export type KpiRow = { key: string; label: string; operations: number; minutes: number; planned: number; good: number; scrap: number; efficiency: number | null; scrapRate: number | null; cost: number };

const pct = (part: number, whole: number) => (whole > 0 ? round2((part / whole) * 100) : null);

function group(state: ErpState, logs: OpLog[], keyOf: (entry: OpLog) => string, labelOf: (entry: OpLog) => string): KpiRow[] {
  const map = new Map<string, KpiRow>();
  for (const entry of logs) {
    const key = keyOf(entry);
    const row = map.get(key) ?? { key, label: labelOf(entry), operations: 0, minutes: 0, planned: 0, good: 0, scrap: 0, efficiency: null, scrapRate: null, cost: 0 };
    row.operations += 1; row.minutes = round2(row.minutes + entry.minutes); row.planned = round2(row.planned + entry.plannedMinutes);
    row.good += entry.qtyGood; row.scrap += entry.qtyScrap; row.cost = round2(row.cost + labourCostOf(state, entry));
    map.set(key, row);
  }
  return [...map.values()].map((row) => ({ ...row, efficiency: pct(row.planned, row.minutes), scrapRate: pct(row.scrap, row.good + row.scrap) }));
}

export const labourCostOf = logLabourCost;

/** Labour cost from the shop-floor log. Closed jobs count with the cost frozen when they closed. */
export function labourCost(state: ErpState, projectId?: string) {
  const closed = state.productionOrders.filter((order) => order.costSnapshot);
  const closedIds = new Set(closed.map((order) => order.id));
  const live = state.opLogs.filter((entry) => (!projectId || entry.projectId === projectId) && !closedIds.has(entry.orderId)).reduce((sum, entry) => sum + labourCostOf(state, entry), 0);
  const frozen = closed.filter((order) => !projectId || order.projectId === projectId).reduce((sum, order) => { const cost = jobCost(state, order.id); return sum + cost.labour + cost.overhead; }, 0);
  return round2(live + frozen);
}

export type KpiFilter = { from?: string; to?: string; employeeId?: string; projectId?: string };

export function filterLogs(state: ErpState, filter: KpiFilter = {}) {
  return state.opLogs.filter((entry) =>
    (!filter.from || entry.end.slice(0, 10) >= filter.from) && (!filter.to || entry.end.slice(0, 10) <= filter.to) &&
    (!filter.employeeId || entry.employeeId === filter.employeeId) && (!filter.projectId || entry.projectId === filter.projectId));
}

/**
 * Shop floor figures from the operation log.
 * Efficiency = planned minutes ÷ actual minutes. Quality = good ÷ (good + scrap).
 * Availability is not measured (no machine data), so this is reported as performance × quality, not as OEE.
 */
export function kpiSummary(state: ErpState, filter: KpiFilter = {}, today = new Date().toISOString().slice(0, 10)) {
  const logs = filterLogs(state, filter);
  const minutes = round2(logs.reduce((sum, entry) => sum + entry.minutes, 0));
  const planned = round2(logs.reduce((sum, entry) => sum + entry.plannedMinutes, 0));
  const good = logs.reduce((sum, entry) => sum + entry.qtyGood, 0);
  const scrap = logs.reduce((sum, entry) => sum + entry.qtyScrap, 0);
  const performance = minutes > 0 ? Math.min(1, planned / minutes) : null;
  const quality = good + scrap > 0 ? good / (good + scrap) : null;
  const days: { date: string; minutes: number; operations: number }[] = [];
  for (let offset = 13; offset >= 0; offset -= 1) {
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - offset);
    const key = date.toISOString().slice(0, 10);
    const dayLogs = logs.filter((entry) => entry.end.slice(0, 10) === key);
    days.push({ date: key, minutes: round2(dayLogs.reduce((sum, entry) => sum + entry.minutes, 0)), operations: dayLogs.length });
  }
  const orders = state.productionOrders.filter((order) => !filter.projectId || order.projectId === filter.projectId);
  return {
    logs, operations: logs.length, minutes, planned, good, scrap,
    efficiency: pct(planned, minutes), scrapRate: pct(scrap, good + scrap),
    performanceQuality: performance !== null && quality !== null ? round2(performance * quality * 100) : null,
    labourCost: round2(logs.reduce((sum, entry) => sum + labourCostOf(state, entry), 0)),
    running: state.activeOps.length,
    openOrders: orders.filter((order) => !isProductionComplete(order.status)).length,
    byOperation: group(state, logs, (entry) => entry.operation.toLowerCase(), (entry) => entry.operation).sort((a, b) => b.minutes - a.minutes),
    byEmployee: group(state, logs, (entry) => entry.employeeId, (entry) => `${entry.employeeName} (${entry.employeeCode})`).sort((a, b) => b.minutes - a.minutes),
    byWorkCenter: group(state, logs, (entry) => entry.workCenter || "—", (entry) => entry.workCenter || "—").sort((a, b) => b.minutes - a.minutes),
    days,
  };
}

/* ============================== Log file ============================== */

export const LOG_COLUMNS = [
  "Log ID", "Date", "Start time", "End time", "Duration (min)", "Planned (min)", "Efficiency %", "Employee ID", "Username", "Production order", "Project",
  "Customer", "Part number", "Revision", "Part description", "Operation no.", "Operation", "Work center", "Qty good", "Qty scrap", "Notes",
] as const;

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Berlin" });
const day = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date(iso));

export function logRows(state: ErpState, logs: OpLog[]): string[][] {
  return logs.map((entry) => {
    const project = state.projects.find((item) => item.id === entry.projectId);
    const customer = project ? state.customers.find((item) => item.id === project.customerId) : null;
    return [
      entry.id, day(entry.start), time(entry.start), time(entry.end), String(entry.minutes), String(entry.plannedMinutes), entry.minutes > 0 ? String(Math.round((entry.plannedMinutes / entry.minutes) * 100)) : "",
      entry.employeeCode, entry.employeeName, entry.orderNumber, project?.code ?? "", customer?.name ?? "", entry.partNumber, entry.revision, entry.partDescription,
      String(entry.seq), entry.operation, entry.workCenter, String(entry.qtyGood), String(entry.qtyScrap), entry.notes,
    ];
  });
}

/** CSV log file (UTF-8, comma separated, quoted where needed) that opens in Excel. */
export function logsToCsv(state: ErpState, logs: OpLog[]) {
  const cell = (value: string) => (/[",\n;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  return [LOG_COLUMNS.map(cell).join(","), ...logRows(state, logs).map((row) => row.map(cell).join(","))].join("\r\n");
}
