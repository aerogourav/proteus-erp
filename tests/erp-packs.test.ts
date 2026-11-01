import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, nextId, parseStoredState, type ErpState } from "../src/lib/erp/model.ts";
import { adjustStock, advanceBlocker, advanceShopOrder, available, cancelShopOrder, createShopOrder, onHand, orderValue, returnShopOrder, saveProduct, WHOLESALE_FACTOR } from "../src/lib/erp/commerce.ts";
import { cancelSubscription, changeSubscription, convertTrial, createSubscription, mrrAt, mrrOf, nextRenewal, runBilling, saasKpis } from "../src/lib/erp/saas.ts";
import { tabsFor } from "../src/lib/erp/packs.ts";
import { createIndustryDemoState } from "../src/lib/erp/demo-companies.ts";
import { alerts } from "../src/lib/erp/alerts.ts";

const NOW = "2026-11-01T10:00:00.000Z";
const TODAY = NOW.slice(0, 10);

function shop(): { state: ErpState; mug: string; wh: string } {
  let state = createInitialState();
  state = { ...state, settings: { ...state.settings, industry: "commerce" } };
  const [wh, withWh] = nextId(state, "wh");
  state = { ...withWh, warehouses: [{ id: wh, code: "HH", name: "Hamburg" }] };
  state = saveProduct(state, null, { sku: "mug-1", name: "Mug", variant: "Blue", category: "Kitchen", price: 20, cost: 7, reorderLevel: 2, supplierId: null, active: true, stock: { [wh]: 5 } }, NOW);
  return { state, mug: state.products[0]!.id, wh };
}

test("commerce: open orders reserve stock and picking is blocked when stock runs short", () => {
  let { state, mug, wh } = shop();
  assert.equal(state.products[0]!.sku, "MUG-1");
  const first = createShopOrder(state, { channel: "Webshop", customer: "Clara", contact: "", country: "DE", warehouseId: wh, lines: [{ productId: mug, quantity: 3 }], shipping: 4.9 }, NOW);
  state = first.state;
  assert.equal(available(state, state.products[0]!), 2);
  const second = createShopOrder(state, { channel: "Webshop", customer: "Jonas", contact: "", country: "DE", warehouseId: wh, lines: [{ productId: mug, quantity: 3 }], shipping: 0 }, NOW);
  state = second.state;
  const blocked = state.shopOrders.find((order) => order.id === second.id)!;
  assert.match(advanceBlocker(state, blocked) ?? "", /Not enough stock/);
  assert.equal(advanceShopOrder(state, second.id!, NOW), state, "blocked order does not move");
  state = cancelShopOrder(state, first.id!, NOW);
  assert.equal(advanceBlocker(state, state.shopOrders.find((order) => order.id === second.id)!), null, "cancelling releases the reservation");
});

test("commerce: shipping takes stock out and issues the invoice; webshop is prepaid, wholesale on terms at trade price", () => {
  let { state, mug, wh } = shop();
  const web = createShopOrder(state, { channel: "Webshop", customer: "Clara", contact: "", country: "DE", warehouseId: wh, lines: [{ productId: mug, quantity: 2 }], shipping: 4.9 }, NOW);
  state = web.state;
  for (let i = 0; i < 3; i += 1) state = advanceShopOrder(state, web.id!, NOW);
  const shipped = state.shopOrders.find((order) => order.id === web.id)!;
  assert.equal(shipped.status, "Shipped");
  assert.equal(onHand(state.products[0]!, wh), 3);
  const invoice = state.invoices.find((item) => item.id === shipped.invoiceId)!;
  assert.equal(invoice.subtotal, 44.9);
  assert.equal(invoice.total, Math.round(44.9 * 1.19 * 100) / 100);
  assert.ok(invoice.paidAt, "webshop orders are paid at checkout");

  const trade = createShopOrder(state, { channel: "Wholesale", customer: "Hafen Store", contact: "", country: "DE", warehouseId: wh, lines: [{ productId: mug, quantity: 2 }], shipping: 0 }, NOW);
  state = trade.state;
  const order = state.shopOrders.find((item) => item.id === trade.id)!;
  assert.equal(order.lines[0]!.unitPrice, 20 * WHOLESALE_FACTOR);
  for (let i = 0; i < 3; i += 1) state = advanceShopOrder(state, trade.id!, NOW);
  const tradeInvoice = state.invoices.find((item) => item.id === state.shopOrders.find((o) => o.id === trade.id)!.invoiceId)!;
  assert.equal(tradeInvoice.paidAt, undefined, "wholesale is invoiced on payment terms");
  assert.equal(state.customers.length, 2);
});

test("commerce: returns can restock; stock never goes below zero", () => {
  let { state, mug, wh } = shop();
  const result = createShopOrder(state, { channel: "Marketplace", customer: "Mia", contact: "", country: "CH", warehouseId: wh, lines: [{ productId: mug, quantity: 2 }], shipping: 0 }, NOW);
  state = result.state;
  for (let i = 0; i < 4; i += 1) state = advanceShopOrder(state, result.id!, NOW);
  assert.equal(state.shopOrders[0]!.status, "Delivered");
  state = returnShopOrder(state, result.id!, "Arrived damaged", true, NOW);
  assert.equal(state.shopOrders[0]!.status, "Returned");
  assert.equal(onHand(state.products[0]!, wh), 5);
  assert.equal(adjustStock(state, mug, wh, -6, "count", NOW), state, "cannot count below zero");
  assert.equal(onHand(adjustStock(state, mug, wh, 10, "Goods receipt", NOW).products[0]!, wh), 15);
});

function saas(): ErpState {
  let state = createInitialState();
  state = { ...state, settings: { ...state.settings, industry: "saas" }, plans: [{ id: "p1", name: "Team", pricePerSeat: 30, interval: "month", description: "" }, { id: "p2", name: "Annual", pricePerSeat: 360, interval: "year", description: "" }] };
  return state;
}

test("saas: trials bring no MRR; conversion, expansion, contraction and churn are recorded", () => {
  let state = saas();
  const trial = createSubscription(state, { customer: "Acme", contact: "", planId: "p1", seats: 10, discountPct: 0, trialDays: 14 }, "2026-09-01T10:00:00.000Z");
  state = trial.state;
  const sub = () => state.subscriptions.find((item) => item.id === trial.id)!;
  assert.equal(mrrOf(state, sub()), 0);
  state = convertTrial(state, trial.id!, "2026-09-15T10:00:00.000Z");
  assert.equal(mrrOf(state, sub()), 300);
  state = changeSubscription(state, trial.id!, { planId: "p1", seats: 12, discountPct: 0 }, "2026-10-10T10:00:00.000Z");
  state = changeSubscription(state, trial.id!, { planId: "p2", seats: 12, discountPct: 10 }, "2026-10-20T10:00:00.000Z");
  assert.equal(mrrOf(state, sub()), 324, "annual plan spread over 12 months, less 10%");
  assert.deepEqual(sub().history.map((entry) => entry.kind), ["new", "expansion", "contraction"]);
  assert.equal(mrrAt(sub(), "2026-10-15T00:00:00.000Z"), 360);
  const k = saasKpis(state, "2026-10-31");
  assert.equal(k.mrr, 324);
  assert.equal(k.movements.expansion, 60);
  assert.equal(k.movements.contraction, 36);
  state = cancelSubscription(state, trial.id!, "Budget", "2026-10-30T10:00:00.000Z");
  assert.equal(mrrOf(state, sub()), 0);
  assert.equal(saasKpis(state, "2026-10-31").movements.churn, 324);
});

test("saas: a billing run invoices each paying subscription once per month", () => {
  let state = saas();
  state = createSubscription(state, { customer: "Acme", contact: "", planId: "p1", seats: 5, discountPct: 0, trialDays: 0 }, "2026-09-03T10:00:00.000Z").state;
  state = createSubscription(state, { customer: "Beta", contact: "", planId: "p1", seats: 2, discountPct: 0, trialDays: 30 }, "2026-10-20T10:00:00.000Z").state;
  const first = runBilling(state, "2026-10", NOW);
  assert.equal(first.count, 1, "trials are not billed");
  assert.equal(first.state.invoices[0]!.subtotal, 150);
  assert.equal(runBilling(first.state, "2026-10", NOW).count, 0, "never twice");
  assert.equal(nextRenewal(first.state, first.state.subscriptions[0]!, "2026-11-01"), "2026-11-03");
});

test("packs: each industry shows its own tabs and names, and keeps names the visitor chose", () => {
  let state = createInitialState();
  const keys = (s: ErpState) => tabsFor(s).map((tab) => tab.key);
  assert.ok(keys(state).includes("production"));
  state = { ...state, settings: { ...state.settings, industry: "commerce" } };
  assert.ok(keys(state).includes("fulfilment") && !keys(state).includes("production") && !keys(state).includes("guided"));
  assert.equal(tabsFor(state).find((tab) => tab.key === "crm")?.label, "Customers");
  state = { ...state, settings: { ...state.settings, tabs: state.settings.tabs.map((tab) => (tab.key === "crm" ? { ...tab, label: "Clients" } : tab)) } };
  assert.equal(tabsFor(state).find((tab) => tab.key === "crm")?.label, "Clients");
  const saasState = { ...state, settings: { ...state.settings, industry: "saas" as const } };
  assert.ok(keys(saasState).includes("subscriptions") && keys(saasState).includes("support") && !keys(saasState).includes("products"));
});

test("saved data from before industry packs opens as manufacturing", () => {
  const old = createInitialState() as unknown as Record<string, unknown>;
  const settings = { ...(old.settings as Record<string, unknown>) };
  delete settings.industry;
  for (const key of ["warehouses", "products", "shopOrders", "plans", "subscriptions", "tickets"]) delete old[key];
  const restored = parseStoredState(JSON.stringify({ ...old, settings }));
  assert.equal(restored.settings.industry, "manufacturing");
  assert.deepEqual(restored.shopOrders, []);
  assert.deepEqual(restored.subscriptions, []);
});

test("sample companies: consistent stock, invoices and MRR, and they survive a save and reload", () => {
  for (const industry of ["commerce", "saas"] as const) {
    const state = createIndustryDemoState(industry, NOW);
    assert.equal(state.settings.industry, industry);
    assert.deepEqual(createIndustryDemoState(industry, NOW).invoices.length, state.invoices.length, "deterministic");
    for (const invoice of state.invoices) {
      const lines = Math.round(invoice.lines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100;
      assert.equal(invoice.subtotal, lines, `${invoice.number} subtotal`);
      assert.equal(invoice.total, Math.round((invoice.subtotal + invoice.tax) * 100) / 100);
    }
    const reloaded = parseStoredState(JSON.stringify(state));
    assert.equal(reloaded.settings.industry, industry);
    assert.equal(reloaded.invoices.length, state.invoices.length);
    assert.ok(alerts(state, TODAY).length > 0, `${industry} has something that needs attention`);
    assert.ok(JSON.stringify(state).length < 1_500_000, "fits comfortably in browser storage");
  }
  const shopState = createIndustryDemoState("commerce", NOW);
  assert.ok(shopState.products.every((product) => Object.values(product.stock).every((units) => units >= 0)), "no negative stock");
  for (const order of shopState.shopOrders.filter((item) => ["Shipped", "Delivered", "Returned"].includes(item.status))) {
    const invoice = shopState.invoices.find((item) => item.id === order.invoiceId);
    assert.ok(invoice, `${order.number} has an invoice`);
    assert.ok(invoice!.subtotal >= orderValue(order));
  }
  assert.ok(shopState.shopOrders.some((order) => order.status === "New" && advanceBlocker(shopState, order)), "one order waits for stock");
  const saasState = createIndustryDemoState("saas", NOW);
  const k = saasKpis(saasState, TODAY);
  assert.equal(k.mrr, Math.round(saasState.subscriptions.reduce((sum, sub) => sum + mrrOf(saasState, sub), 0) * 100) / 100);
  assert.ok(k.months[0]!.mrr < k.mrr, "MRR grew over six months");
  assert.ok(k.trials.length >= 2 && k.pastDue.length === 1);
});

test("tabs added in a newer version slot in at their default place, not at the end", () => {
  const base = createInitialState();
  const oldTabs = base.settings.tabs.filter((tab) => !["fulfilment", "products", "subscriptions", "support"].includes(tab.key)).map((tab) => (tab.key === "parts" ? { ...tab, label: "Components" } : tab));
  const restored = parseStoredState(JSON.stringify({ ...base, settings: { ...base.settings, industry: "commerce", tabs: oldTabs } }));
  const keys = tabsFor(restored).map((tab) => tab.key);
  assert.deepEqual(keys.slice(0, 4), ["overview", "inbox", "fulfilment", "products"]);
  assert.equal(restored.settings.tabs.find((tab) => tab.key === "parts")?.label, "Components", "the visitor's own names survive");
});
