/**
 * E-commerce and wholesale rules. Stock is kept per warehouse; open orders reserve it; shipping takes it out and
 * issues the customer invoice; a return can put items back on the shelf. Pure functions, unit-tested.
 */
import { log, nextId, numberFor, round2, touch, type ErpState, type Product, type SalesChannel, type ShopOrder, type ShopOrderStatus } from "./model.ts";
import { customerName, ensureCustomer, issueInvoice } from "./pack-records.ts";

export const WHOLESALE_FACTOR = 0.55;

export const onHand = (product: Product, warehouseId?: string) =>
  warehouseId ? product.stock[warehouseId] ?? 0 : Object.values(product.stock).reduce((sum, value) => sum + value, 0);

const OPEN: ShopOrderStatus[] = ["New", "Picked", "Packed"];
export const isOpen = (order: ShopOrder) => OPEN.includes(order.status);

/** Units promised to open orders that have not shipped yet. */
export function reserved(state: ErpState, productId: string, warehouseId?: string) {
  return state.shopOrders.filter((order) => isOpen(order) && (!warehouseId || order.warehouseId === warehouseId))
    .reduce((sum, order) => sum + order.lines.filter((line) => line.productId === productId).reduce((total, line) => total + line.quantity, 0), 0);
}

export const available = (state: ErpState, product: Product, warehouseId?: string) => onHand(product, warehouseId) - reserved(state, product.id, warehouseId);

export const orderValue = (order: ShopOrder) => round2(order.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
export const productLabel = (product: Product | undefined) => product ? `${product.name}${product.variant ? ` · ${product.variant}` : ""}` : "Removed product";

/** Lines that cannot be picked from the order's warehouse right now (stock on hand, ignoring this order's own reservation). */
export function shortages(state: ErpState, order: ShopOrder) {
  return order.lines.flatMap((line) => {
    const product = state.products.find((item) => item.id === line.productId);
    const free = product ? onHand(product, order.warehouseId) - (reserved(state, line.productId, order.warehouseId) - line.quantity) : 0;
    return free < line.quantity ? [{ productId: line.productId, label: productLabel(product), missing: line.quantity - Math.max(0, free) }] : [];
  });
}

export type ShopOrderInput = { channel: SalesChannel; customer: string; contact: string; country: string; warehouseId: string; lines: { productId: string; quantity: number }[]; shipping: number };

export function shopOrderError(state: ErpState, input: ShopOrderInput): string | null {
  if (!input.customer.trim()) return "Enter the customer.";
  if (!state.warehouses.some((item) => item.id === input.warehouseId)) return "Choose a warehouse.";
  const lines = input.lines.filter((line) => line.quantity > 0);
  if (!lines.length) return "Add at least one product.";
  if (lines.some((line) => !state.products.some((item) => item.id === line.productId) || !Number.isInteger(line.quantity))) return "Quantities must be whole numbers of existing products.";
  if (!(input.shipping >= 0)) return "Shipping cannot be negative.";
  return null;
}

export function createShopOrder(input: ErpState, order: ShopOrderInput, now: string): { state: ErpState; id: string | null } {
  if (shopOrderError(input, order)) return { state: input, id: null };
  const customer = ensureCustomer(input, order.customer, order.contact, now);
  const [id, next] = nextId(customer.state, "so");
  const number = numberFor("SO-", next.shopOrders.map((item) => item.number), 10001, 5);
  // Wholesale customers buy at the trade price (retail less 45%).
  const priceFor = (price: number) => (order.channel === "Wholesale" ? round2(price * WHOLESALE_FACTOR) : price);
  const lines = order.lines.filter((line) => line.quantity > 0).map((line) => ({ ...line, unitPrice: priceFor(next.products.find((item) => item.id === line.productId)!.price) }));
  const record: ShopOrder = { id, number, channel: order.channel, customerId: customer.id, country: order.country.trim() || "DE", warehouseId: order.warehouseId, lines, shipping: round2(order.shipping), status: "New", createdAt: now };
  return { state: log({ ...next, shopOrders: [...next.shopOrders, record] }, now, "fulfilment", `Order ${number} received from ${record.channel} · ${customerName(next, customer.id)}`, null), id };
}

/** Why the order cannot move to the next step, or null. */
export function advanceBlocker(state: ErpState, order: ShopOrder): string | null {
  if (order.status === "New") {
    const missing = shortages(state, order);
    if (missing.length) return `Not enough stock: ${missing.map((item) => `${item.missing} × ${item.label}`).join(", ")}.`;
  }
  if (!["New", "Picked", "Packed", "Shipped"].includes(order.status)) return "This order is finished.";
  return null;
}

/** New → Picked → Packed → Shipped (stock out, invoice issued) → Delivered. */
export function advanceShopOrder(state: ErpState, orderId: string, now: string, shipping: { carrier?: string; tracking?: string } = {}): ErpState {
  const order = state.shopOrders.find((item) => item.id === orderId);
  if (!order || advanceBlocker(state, order)) return state;
  if (order.status === "New") return log({ ...state, shopOrders: touch(state.shopOrders, orderId, (item) => ({ ...item, status: "Picked", pickedAt: now })) }, now, "fulfilment", `Order ${order.number} picked`, null);
  if (order.status === "Picked") return log({ ...state, shopOrders: touch(state.shopOrders, orderId, (item) => ({ ...item, status: "Packed", packedAt: now })) }, now, "fulfilment", `Order ${order.number} packed`, null);
  if (order.status === "Shipped") return log({ ...state, shopOrders: touch(state.shopOrders, orderId, (item) => ({ ...item, status: "Delivered", deliveredAt: now })) }, now, "fulfilment", `Order ${order.number} delivered`, null);
  // Packed → Shipped: take the stock out of the warehouse and invoice the customer.
  let next: ErpState = { ...state, products: state.products.map((product) => {
    const units = order.lines.filter((line) => line.productId === product.id).reduce((sum, line) => sum + line.quantity, 0);
    return units ? { ...product, stock: { ...product.stock, [order.warehouseId]: onHand(product, order.warehouseId) - units } } : product;
  }) };
  const lines = [
    ...order.lines.map((line) => { const product = next.products.find((item) => item.id === line.productId); return { description: `${productLabel(product)} (${product?.sku ?? ""})`, quantity: line.quantity, unit: "pcs", unitPrice: line.unitPrice, amount: round2(line.quantity * line.unitPrice) }; }),
    ...(order.shipping ? [{ description: "Shipping", quantity: 1, unit: "x", unitPrice: order.shipping, amount: order.shipping }] : []),
  ];
  // Webshop and marketplace orders are paid at checkout; wholesale and store accounts are invoiced with payment terms.
  const prepaid = order.channel === "Webshop" || order.channel === "Marketplace";
  const invoice = issueInvoice(next, { customerId: order.customerId, lines, issuedAt: now, paid: prepaid, paidAt: order.createdAt.slice(0, 10) });
  next = { ...invoice.state, shopOrders: touch(invoice.state.shopOrders, orderId, (item) => ({ ...item, status: "Shipped", shippedAt: now, carrier: shipping.carrier?.trim() || "DHL", tracking: shipping.tracking?.trim() || `JD${order.number.replace(/\D/g, "")}DE`, invoiceId: invoice.id })) };
  return log(next, now, "fulfilment", `Order ${order.number} shipped from ${next.warehouses.find((item) => item.id === order.warehouseId)?.code ?? "stock"}; invoice issued`, null);
}

export function cancelShopOrder(state: ErpState, orderId: string, now: string): ErpState {
  const order = state.shopOrders.find((item) => item.id === orderId);
  if (!order || !isOpen(order)) return state;
  return log({ ...state, shopOrders: touch(state.shopOrders, orderId, (item) => ({ ...item, status: "Cancelled" })) }, now, "fulfilment", `Order ${order.number} cancelled; reserved stock released`, null);
}

/** A shipped or delivered order comes back. Restocking puts the units back in the order's warehouse. */
export function returnShopOrder(state: ErpState, orderId: string, reason: string, restock: boolean, now: string): ErpState {
  const order = state.shopOrders.find((item) => item.id === orderId);
  if (!order || (order.status !== "Shipped" && order.status !== "Delivered")) return state;
  const products = restock ? state.products.map((product) => {
    const units = order.lines.filter((line) => line.productId === product.id).reduce((sum, line) => sum + line.quantity, 0);
    return units ? { ...product, stock: { ...product.stock, [order.warehouseId]: onHand(product, order.warehouseId) + units } } : product;
  }) : state.products;
  const next = { ...state, products, shopOrders: touch(state.shopOrders, orderId, (item) => ({ ...item, status: "Returned" as const, returnedAt: now, returnReason: reason.trim() || "No reason given", restocked: restock })) };
  return log(next, now, "fulfilment", `Order ${order.number} returned${restock ? " and restocked" : ""}: ${reason.trim() || "no reason given"}`, null);
}

/** Goods arrive or are counted: a positive or negative correction with a reason. */
export function adjustStock(state: ErpState, productId: string, warehouseId: string, delta: number, reason: string, now: string): ErpState {
  const product = state.products.find((item) => item.id === productId);
  if (!product || !Number.isInteger(delta) || delta === 0 || onHand(product, warehouseId) + delta < 0) return state;
  const next = { ...state, products: touch(state.products, productId, (item) => ({ ...item, stock: { ...item.stock, [warehouseId]: onHand(item, warehouseId) + delta } })) };
  return log(next, now, "products", `${delta > 0 ? "+" : ""}${delta} × ${product.sku} in ${state.warehouses.find((item) => item.id === warehouseId)?.code ?? "stock"} (${reason.trim() || "adjustment"})`, null);
}

export type ProductInput = Omit<Product, "id" | "stock"> & { stock?: Record<string, number> };

export function productError(state: ErpState, input: ProductInput, id: string | null = null): string | null {
  if (!input.sku.trim() || !input.name.trim()) return "Enter the SKU and name.";
  if (state.products.some((item) => item.id !== id && item.sku.trim().toUpperCase() === input.sku.trim().toUpperCase())) return "That SKU is already used.";
  if (!(input.price >= 0) || !(input.cost >= 0) || !(input.reorderLevel >= 0)) return "Price, cost and reorder level cannot be negative.";
  return null;
}

export function saveProduct(state: ErpState, id: string | null, input: ProductInput, now: string): ErpState {
  if (productError(state, input, id)) return state;
  const clean = { ...input, sku: input.sku.trim().toUpperCase(), name: input.name.trim(), variant: input.variant.trim(), category: input.category.trim(), price: round2(input.price), cost: round2(input.cost) };
  if (id) return log({ ...state, products: touch(state.products, id, (item) => ({ ...item, ...clean, stock: input.stock ?? item.stock })) }, now, "products", `Product ${clean.sku} updated`, null);
  const [newId, next] = nextId(state, "prd");
  return log({ ...next, products: [...next.products, { id: newId, ...clean, stock: input.stock ?? {} }] }, now, "products", `Product ${clean.sku} added`, null);
}

/** Figures for the commerce overview. Revenue counts shipped orders net of returns, in the default currency. */
export function commerceKpis(state: ErpState, today: string) {
  const since = (days: number) => new Date(Date.parse(`${today}T12:00:00Z`) - days * 86400000).toISOString().slice(0, 10);
  const from30 = since(30);
  const shipped = state.shopOrders.filter((order) => order.shippedAt && order.shippedAt.slice(0, 10) >= from30);
  const returned = shipped.filter((order) => order.status === "Returned");
  const revenue = round2(shipped.filter((order) => order.status !== "Returned").reduce((sum, order) => sum + orderValue(order), 0));
  const toShip = state.shopOrders.filter(isOpen);
  const late = toShip.filter((order) => order.createdAt.slice(0, 10) < since(1));
  const lowStock = state.products.filter((product) => product.active && available(state, product) <= product.reorderLevel);
  const stockValue = round2(state.products.reduce((sum, product) => sum + onHand(product) * product.cost, 0));
  const byChannel = (["Webshop", "Marketplace", "Wholesale", "Retail store"] as SalesChannel[]).map((channel) => ({
    channel, value: round2(shipped.filter((order) => order.channel === channel && order.status !== "Returned").reduce((sum, order) => sum + orderValue(order), 0)),
  }));
  const units = new Map<string, number>();
  for (const order of shipped.filter((item) => item.status !== "Returned")) for (const line of order.lines) units.set(line.productId, (units.get(line.productId) ?? 0) + line.quantity);
  const top = [...units.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([productId, quantity]) => ({ product: state.products.find((item) => item.id === productId), quantity }));
  const cost = round2(shipped.filter((order) => order.status !== "Returned").reduce((sum, order) => sum + order.lines.reduce((total, line) => total + line.quantity * (state.products.find((item) => item.id === line.productId)?.cost ?? 0), 0), 0));
  return {
    revenue, orders: shipped.length, averageOrder: shipped.length ? round2(revenue / Math.max(1, shipped.length - returned.length)) : 0,
    returnRate: shipped.length ? returned.length / shipped.length : 0, grossMargin: revenue ? (revenue - cost) / revenue : 0,
    toShip, late, lowStock, stockValue, byChannel, top,
  };
}
