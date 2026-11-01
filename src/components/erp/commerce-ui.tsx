"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Ban, PackageCheck, PackagePlus, Plus, RotateCcw, Truck, Undo2 } from "lucide-react";
import { BarList, CHART_COLORS, Stat } from "@/components/erp/charts";
import { EditButton, useEditor } from "@/components/erp/edit";
import { Loading } from "@/components/erp/modules";
import { commit, nowIso, todayIso, useErp, useHydrated } from "@/components/erp/store";
import { toast } from "@/components/erp/toast";
import { Badge, EmptyState, Field, Modal, PageHead, Rule } from "@/components/erp/ui";
import {
  adjustStock, advanceBlocker, advanceShopOrder, available, cancelShopOrder, commerceKpis, createShopOrder, isOpen, onHand, orderValue, productError,
  productLabel, reserved, returnShopOrder, saveProduct, shopOrderError, WHOLESALE_FACTOR, type ShopOrderInput,
} from "@/lib/erp/commerce";
import { customerName } from "@/lib/erp/pack-records";
import { SALES_CHANNELS, formatDate, formatMoney, type ErpState, type Product, type SalesChannel, type ShopOrder } from "@/lib/erp/model";

const money = (state: ErpState, value: number) => formatMoney(value, state.settings.defaultCurrency);
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
const units = (order: ShopOrder) => order.lines.reduce((sum, line) => sum + line.quantity, 0);
const channelTone = (channel: SalesChannel) => (channel === "Wholesale" ? "warn" as const : channel === "Marketplace" ? "info" as const : "neutral" as const);
const age = (iso: string) => {
  const hours = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 3600000));
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
};

/* ============================== Orders & shipping ============================== */

const STEP: Record<string, { label: string; icon: typeof Truck }> = { New: { label: "Pick", icon: PackageCheck }, Picked: { label: "Pack", icon: PackagePlus }, Packed: { label: "Ship", icon: Truck } };
type OrderView = "open" | "shipped" | "returns" | "all";

export function FulfilmentModule() {
  const state = useErp();
  const hydrated = useHydrated();
  const params = useSearchParams();
  const router = useRouter();
  const editor = useEditor();
  const [view, setView] = useState<OrderView>("open");
  // "?new=1" (the dock's + button) opens the new-order form straight away; the URL is then cleaned up.
  const [creating, setCreating] = useState(() => params.get("new") === "1");
  useEffect(() => { if (params.get("new") === "1") router.replace("/demo/fulfilment"); }, [params, router]);
  const head = <PageHead eyebrow="Fulfilment" title="Orders & shipping" description="Orders from the webshop, marketplace, wholesale and the store, one queue. Picking checks stock, shipping takes it out and issues the invoice." actions={<button type="button" className="erp-btn erp-btn-primary" onClick={() => setCreating(true)}><Plus size={15} /> New order</button>} />;
  if (!hydrated) return <>{head}<Loading /></>;
  const today = todayIso();
  const open = state.shopOrders.filter(isOpen);
  const blocked = open.filter((order) => order.status === "New" && advanceBlocker(state, order));
  const shippedWeek = state.shopOrders.filter((order) => order.shippedAt && Date.parse(`${today}T23:59:59Z`) - Date.parse(order.shippedAt) <= 7 * 86400000).length;
  const advance = (order: ShopOrder) => {
    const reason = advanceBlocker(state, order);
    if (reason) { toast(reason, { tone: "bad" }); return; }
    commit((value) => advanceShopOrder(value, order.id, nowIso()));
    toast(order.status === "Packed" ? `${order.number} shipped. Stock updated and invoice issued.` : `${order.number} ${order.status === "New" ? "picked" : "packed"}.`, { tone: "ok" });
  };
  const returnOrder = (order: ShopOrder) => editor.open({
    title: `Return ${order.number}`,
    fields: [{ key: "reason", label: "Reason", required: true, list: ["Changed my mind", "Arrived damaged", "Wrong item", "Wrong size ordered", "Colour different from photo"] }, { key: "restock", label: "Put the items back in stock?", type: "select", options: ["Yes, resellable", "No, write off"] }],
    initial: { reason: "", restock: "Yes, resellable" },
    onSave: (values) => { commit((value) => returnShopOrder(value, order.id, values.reason ?? "", values.restock !== "No, write off", nowIso())); return null; },
  });
  const tabs = <div className="erp-tabs" role="group" aria-label="Order view" style={{ marginBottom: 16 }}>
    {([["open", `Open (${open.length})`], ["shipped", "Shipped"], ["returns", "Returns"], ["all", "All orders"]] as [OrderView, string][]).map(([key, label]) => <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)}>{label}</button>)}
  </div>;
  const list = view === "shipped" ? state.shopOrders.filter((order) => order.status === "Shipped" || order.status === "Delivered")
    : view === "returns" ? state.shopOrders.filter((order) => order.status === "Returned")
    : state.shopOrders;
  const columns = "minmax(0,1.1fr) minmax(0,1.5fr) 120px 70px 110px 120px minmax(0,1.3fr)";
  return <>{head}
    <section className="erp-kpis" aria-label="Fulfilment figures">
      <Stat label="To pick" value={open.filter((order) => order.status === "New").length} note={blocked.length ? `${blocked.length} waiting for stock` : "All in stock"} tone={blocked.length ? "bad" : undefined} />
      <Stat label="To pack" value={open.filter((order) => order.status === "Picked").length} />
      <Stat label="To ship" value={open.filter((order) => order.status === "Packed").length} />
      <Stat label="Shipped, last 7 days" value={shippedWeek} />
    </section>
    <div style={{ marginTop: 18 }}>{tabs}</div>
    {view === "open" ? <div className="erp-board" role="list" aria-label="Open orders by step">
      {(["New", "Picked", "Packed"] as const).map((status) => {
        const cards = open.filter((order) => order.status === status).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        const step = STEP[status]!;
        return <section key={status} className={`erp-board-col is-${status.toLowerCase()}`} role="listitem" aria-label={`${status === "New" ? "To pick" : status === "Picked" ? "To pack" : "To ship"}: ${cards.length}`}>
          <header><span className="erp-board-dot" aria-hidden="true" /><b>{status === "New" ? "To pick" : status === "Picked" ? "To pack" : "To ship"}</b><em>{cards.length}</em></header>
          {cards.map((order) => {
            const reason = status === "New" ? advanceBlocker(state, order) : null;
            const Icon = step.icon;
            return <article key={order.id} className="erp-board-card">
              <div className="erp-board-card-top"><strong>{order.number}</strong><Badge tone={channelTone(order.channel)}>{order.channel}</Badge></div>
              <span>{customerName(state, order.customerId)} · {order.country}</span>
              <ul>{order.lines.map((line) => { const product = state.products.find((item) => item.id === line.productId); return <li key={line.productId}>{line.quantity} × {productLabel(product)}</li>; })}</ul>
              <div className="erp-board-card-foot"><b>{money(state, orderValue(order) + order.shipping)}</b><small>{age(order.createdAt)} · {state.warehouses.find((item) => item.id === order.warehouseId)?.code}</small></div>
              {reason && <p className="erp-error" style={{ fontWeight: 600 }}>{reason}</p>}
              <div className="erp-head-actions">
                <button type="button" className="erp-btn erp-btn-primary erp-btn-sm" disabled={Boolean(reason)} onClick={() => advance(order)}><Icon size={14} /> {step.label}</button>
                <button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" onClick={() => { commit((value) => cancelShopOrder(value, order.id, nowIso())); toast(`${order.number} cancelled; stock released.`); }}><Ban size={13} /> Cancel</button>
              </div>
            </article>;
          })}
          {!cards.length && <p className="erp-faint" style={{ padding: "4px 6px" }}>Nothing here.</p>}
        </section>;
      })}
    </div> : <section className="erp-card">
      {list.length ? <div className="erp-rows" role="table">
        <div className="erp-row erp-row-head" role="row" style={{ gridTemplateColumns: columns }}>{["Order", "Customer", "Channel", "Items", "Value", "Status", ""].map((label) => <span key={label} role="columnheader">{label}</span>)}</div>
        {[...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 80).map((order) => <div key={order.id} role="row" className="erp-row" style={{ gridTemplateColumns: columns }}>
          <span><strong>{order.number}</strong><small>{formatDate(order.createdAt)}</small></span>
          <span>{customerName(state, order.customerId)}<small>{order.country}{order.returnReason ? ` · ${order.returnReason}` : ""}</small></span>
          <span><Badge tone={channelTone(order.channel)}>{order.channel}</Badge></span>
          <span className="erp-num" style={{ textAlign: "left" }}>{units(order)}</span>
          <span className="erp-num" style={{ textAlign: "left" }}>{money(state, orderValue(order))}</span>
          <span><Badge tone={order.status === "Delivered" ? "ok" : order.status === "Returned" || order.status === "Cancelled" ? "bad" : "info"}>{order.status}</Badge>{order.tracking && <small>{order.carrier} {order.tracking}</small>}</span>
          <span className="erp-head-actions">
            {order.status === "Shipped" && <button type="button" className="erp-btn erp-btn-sm" onClick={() => commit((value) => advanceShopOrder(value, order.id, nowIso()))}><ArrowRight size={13} /> Delivered</button>}
            {(order.status === "Shipped" || order.status === "Delivered") && <button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" onClick={() => returnOrder(order)}><Undo2 size={13} /> Return</button>}
            {order.invoiceId && <Link className="erp-btn erp-btn-ghost erp-btn-sm" href="/demo/finance?view=invoices">{state.invoices.find((item) => item.id === order.invoiceId)?.number ?? "Invoice"}</Link>}
          </span>
        </div>)}
      </div> : <EmptyState title="No orders here" text="Shipped orders and returns appear here." />}
    </section>}
    <div style={{ marginTop: 14 }}><Rule>Open orders reserve stock in their warehouse. An order can only be picked when enough is available. Shipping takes the units out and issues the invoice: webshop and marketplace orders are already paid, wholesale is invoiced on {state.settings.paymentTermsDays}-day terms at the trade price (retail − {Math.round((1 - WHOLESALE_FACTOR) * 100)}%).</Rule></div>
    {creating && <NewOrderDialog state={state} onClose={() => setCreating(false)} />}
    {editor.dialog}
  </>;
}

function NewOrderDialog({ state, onClose }: { state: ErpState; onClose: () => void }) {
  const products = state.products.filter((item) => item.active);
  const [form, setForm] = useState({ channel: "Webshop" as SalesChannel, customer: "", contact: "", country: "DE", warehouseId: state.warehouses[0]?.id ?? "", shipping: "4.90" });
  const [lines, setLines] = useState([{ productId: products[0]?.id ?? "", quantity: "1" }]);
  const [error, setError] = useState("");
  const input: ShopOrderInput = { ...form, shipping: Number(form.shipping.replace(",", ".")) || 0, lines: lines.map((line) => ({ productId: line.productId, quantity: Number(line.quantity) })) };
  const save = () => {
    const problem = shopOrderError(state, input);
    if (problem) { setError(problem); return; }
    commit((value) => createShopOrder(value, input, nowIso()).state);
    toast(`Order for ${input.customer} added to the queue.`, { tone: "ok" });
    onClose();
  };
  return <Modal label="New order" onClose={onClose}>
    <form className="erp-stack" style={{ gap: 14 }} onSubmit={(event) => { event.preventDefault(); save(); }}>
      <h2>New order</h2>
      <div className="erp-form-grid">
        <Field id="no-channel" label="Channel"><select id="no-channel" className="erp-select" value={form.channel} onChange={(event) => setForm({ ...form, channel: event.target.value as SalesChannel, shipping: event.target.value === "Wholesale" || event.target.value === "Retail store" ? "0" : form.shipping })}>{SALES_CHANNELS.map((channel) => <option key={channel}>{channel}</option>)}</select></Field>
        <Field id="no-warehouse" label="Ship from"><select id="no-warehouse" className="erp-select" value={form.warehouseId} onChange={(event) => setForm({ ...form, warehouseId: event.target.value })}>{state.warehouses.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></Field>
        <Field id="no-customer" label="Customer"><input id="no-customer" className="erp-input" list="no-customers" value={form.customer} onChange={(event) => setForm({ ...form, customer: event.target.value })} /></Field>
        <Field id="no-country" label="Country"><input id="no-country" className="erp-input" maxLength={2} value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value.toUpperCase() })} /></Field>
      </div>
      <datalist id="no-customers">{state.customers.map((item) => <option key={item.id} value={item.name} />)}</datalist>
      <div className="erp-stack" style={{ gap: 8 }}>
        <span className="erp-label">Products</span>
        {lines.map((line, index) => {
          const product = products.find((item) => item.id === line.productId);
          return <div key={index} className="erp-inline">
            <select className="erp-select" aria-label={`Product ${index + 1}`} value={line.productId} onChange={(event) => setLines(lines.map((item, i) => (i === index ? { ...item, productId: event.target.value } : item)))}>
              {products.map((item) => <option key={item.id} value={item.id}>{productLabel(item)} · {available(state, item, form.warehouseId)} available</option>)}
            </select>
            <input className="erp-input" style={{ maxWidth: 90 }} aria-label={`Quantity ${index + 1}`} inputMode="numeric" value={line.quantity} onChange={(event) => setLines(lines.map((item, i) => (i === index ? { ...item, quantity: event.target.value } : item)))} />
            {product && <span className="erp-faint" style={{ alignSelf: "center", minWidth: 70 }}>{money(state, form.channel === "Wholesale" ? product.price * WHOLESALE_FACTOR : product.price)}</span>}
          </div>;
        })}
        {lines.length < 6 && <button type="button" className="erp-btn erp-btn-ghost erp-btn-sm" style={{ justifySelf: "start" }} onClick={() => setLines([...lines, { productId: products[0]?.id ?? "", quantity: "1" }])}><Plus size={13} /> Add product</button>}
      </div>
      <Field id="no-shipping" label="Shipping charged"><input id="no-shipping" className="erp-input" inputMode="decimal" value={form.shipping} onChange={(event) => setForm({ ...form, shipping: event.target.value })} /></Field>
      {error && <p className="erp-error" role="alert">{error}</p>}
      <div className="erp-head-actions" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="erp-btn erp-btn-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="erp-btn erp-btn-primary">Add order</button>
      </div>
    </form>
  </Modal>;
}

/* ============================== Products & stock ============================== */

export function ProductsModule() {
  const state = useErp();
  const hydrated = useHydrated();
  const editor = useEditor();
  const [warehouse, setWarehouse] = useState<string>("all");
  const head = <PageHead eyebrow="Catalogue" title="Products & stock" description="Every product and variant with price, cost and stock per warehouse. Available = on hand − reserved by open orders." actions={<button type="button" className="erp-btn erp-btn-primary" onClick={() => openProduct(state, editor.open, null)}><Plus size={15} /> Add product</button>} />;
  if (!hydrated) return <>{head}<Loading /></>;
  const where = warehouse === "all" ? undefined : warehouse;
  const products = [...state.products].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name) || a.variant.localeCompare(b.variant));
  const low = products.filter((product) => product.active && available(state, product, where) <= product.reorderLevel);
  const value = products.reduce((sum, product) => sum + onHand(product, where) * product.cost, 0);
  const adjust = (product: Product) => editor.open({
    title: `Stock for ${product.sku}`,
    fields: [
      { key: "warehouse", label: "Warehouse", type: "select", options: state.warehouses.map((item) => `${item.code} · ${item.name}`) },
      { key: "delta", label: "Change (units)", type: "number", required: true, help: "Positive when goods arrive, negative for breakage or a count difference." },
      { key: "reason", label: "Reason", list: ["Goods receipt", "Stock count", "Damaged", "Sample"] },
    ],
    initial: { warehouse: `${state.warehouses[0]?.code} · ${state.warehouses[0]?.name}`, delta: "", reason: "Goods receipt" },
    onSave: (values) => {
      const target = state.warehouses.find((item) => values.warehouse?.startsWith(`${item.code} ·`));
      const delta = Number(values.delta);
      if (!target || !Number.isInteger(delta) || delta === 0) return "Enter a whole number of units, not zero.";
      if (onHand(product, target.id) + delta < 0) return `Only ${onHand(product, target.id)} on hand in ${target.code}.`;
      commit((current) => adjustStock(current, product.id, target.id, delta, values.reason ?? "", nowIso()));
      return null;
    },
  });
  const columns = `minmax(0,1.8fr) minmax(0,0.9fr) 120px ${state.warehouses.map(() => "70px").join(" ")} 80px 100px 170px`;
  return <>{head}
    <section className="erp-kpis" aria-label="Stock figures">
      <Stat label="Active products" value={products.filter((item) => item.active).length} note={`${new Set(products.map((item) => item.name)).size} products, with variants`} />
      <Stat label="Stock value" value={money(state, value)} note="At cost" />
      <Stat label="Low stock" value={low.length} note={low.length ? low.map((item) => item.sku).join(", ") : "Nothing to reorder"} tone={low.length ? "warn" : undefined} />
      <Stat label="Units on hand" value={products.reduce((sum, product) => sum + onHand(product, where), 0)} note={where ? state.warehouses.find((item) => item.id === where)?.name : "All warehouses"} />
    </section>
    <div className="erp-tabs" role="group" aria-label="Warehouse" style={{ margin: "18px 0 16px" }}>
      <button type="button" aria-pressed={warehouse === "all"} onClick={() => setWarehouse("all")}>All warehouses</button>
      {state.warehouses.map((item) => <button key={item.id} type="button" aria-pressed={warehouse === item.id} onClick={() => setWarehouse(item.id)}>{item.name}</button>)}
    </div>
    <section className="erp-card">
      {products.length ? <div className="erp-rows" role="table">
        <div className="erp-row erp-row-head" role="row" style={{ gridTemplateColumns: columns }}>{["Product", "Category", "Price · margin", ...state.warehouses.map((item) => item.code), "Reserved", "Available", ""].map((label) => <span key={label} role="columnheader">{label}</span>)}</div>
        {products.map((product) => {
          const free = available(state, product, where);
          const margin = product.price ? (product.price - product.cost) / product.price : 0;
          return <div key={product.id} role="row" className="erp-row" style={{ gridTemplateColumns: columns }}>
            <span><strong>{productLabel(product)}</strong><small>{product.sku}{product.supplierId ? ` · ${state.suppliers.find((item) => item.id === product.supplierId)?.name ?? ""}` : ""}</small></span>
            <span className="erp-muted">{product.category}</span>
            <span>{money(state, product.price)}<small>{pct(margin)} margin</small></span>
            {state.warehouses.map((item) => <span key={item.id} className="erp-num" style={{ textAlign: "left" }}>{onHand(product, item.id)}</span>)}
            <span className="erp-num" style={{ textAlign: "left" }}>{reserved(state, product.id, where) || "—"}</span>
            <span>{free <= product.reorderLevel ? <Badge tone={free <= 0 ? "bad" : "warn"}>{String(free)}</Badge> : <b>{free}</b>}<small>reorder at {product.reorderLevel}</small></span>
            <span className="erp-head-actions"><button type="button" className="erp-btn erp-btn-sm" onClick={() => adjust(product)}><RotateCcw size={13} /> Stock</button><EditButton onClick={() => openProduct(state, editor.open, product)} /></span>
          </div>;
        })}
      </div> : <EmptyState title="No products yet" text="Add your first product to start selling." />}
    </section>
    <div style={{ marginTop: 14 }}><Rule>Stock changes only through shipments, returns and recorded adjustments, each with a reason in the activity log. Low stock means available stock is at or below the reorder level.</Rule></div>
    {editor.dialog}
  </>;
}

function openProduct(state: ErpState, open: ReturnType<typeof useEditor>["open"], product: Product | null) {
  const suppliers = state.suppliers.map((item) => item.name);
  open({
    title: product ? `Edit ${product.sku}` : "Add product",
    fields: [
      { key: "sku", label: "SKU", required: true }, { key: "name", label: "Product name", required: true }, { key: "variant", label: "Variant (colour, size…)" },
      { key: "category", label: "Category", list: [...new Set(state.products.map((item) => item.category))] },
      { key: "price", label: "Retail price", type: "number", required: true }, { key: "cost", label: "Cost price", type: "number", required: true },
      { key: "reorderLevel", label: "Reorder level (units)", type: "number" }, { key: "supplier", label: "Supplier", type: "select", options: ["—", ...suppliers] },
    ],
    initial: product ? { sku: product.sku, name: product.name, variant: product.variant, category: product.category, price: String(product.price), cost: String(product.cost), reorderLevel: String(product.reorderLevel), supplier: state.suppliers.find((item) => item.id === product.supplierId)?.name ?? "—" }
      : { sku: "", name: "", variant: "", category: "", price: "", cost: "", reorderLevel: "10", supplier: "—" },
    onSave: (values) => {
      const input = { sku: values.sku ?? "", name: values.name ?? "", variant: values.variant ?? "", category: values.category ?? "", price: Number(values.price), cost: Number(values.cost), reorderLevel: Number(values.reorderLevel || 0), supplierId: state.suppliers.find((item) => item.name === values.supplier)?.id ?? null, active: product?.active ?? true };
      const problem = productError(state, input, product?.id ?? null);
      if (problem) return problem;
      commit((current) => saveProduct(current, product?.id ?? null, input, nowIso()));
      return null;
    },
  });
}

/* ============================== Overview ============================== */

export function CommerceFigures({ state }: { state: ErpState }) {
  const k = commerceKpis(state, todayIso());
  return <>
    <section className="erp-kpis" aria-label="Key figures">
      <Stat label="Revenue, 30 days" value={money(state, k.revenue)} note={`${k.orders} orders shipped`} />
      <Stat label="Average order" value={money(state, k.averageOrder)} note="Incl. wholesale" />
      <Stat label="Gross margin" value={pct(k.grossMargin)} note="Revenue − product cost" />
      <Stat label="Return rate" value={pct(k.returnRate)} note="Of orders shipped in 30 days" tone={k.returnRate > 0.08 ? "warn" : undefined} />
    </section>
    <div className="erp-grid-2" style={{ marginTop: 16 }}>
      <section className="erp-card erp-card-pad erp-stack"><h2 className="erp-chart-title">Revenue by channel, 30 days</h2>
        <BarList label="Revenue by channel" data={k.byChannel.filter((row) => row.value > 0).map((row, index) => ({ label: row.channel, value: row.value, display: money(state, row.value), color: CHART_COLORS[index % CHART_COLORS.length] }))} />
      </section>
      <section className="erp-card erp-card-pad erp-stack"><h2 className="erp-chart-title">Best sellers, 30 days</h2>
        <BarList label="Best sellers by units" data={k.top.map((row) => ({ label: productLabel(row.product), value: row.quantity, display: `${row.quantity} pcs` }))} />
      </section>
    </div>
    <section className="erp-card" style={{ marginTop: 16 }}>
      <div className="erp-card-head"><div><h2>Ship today</h2><p>{k.toShip.length} open order{k.toShip.length === 1 ? "" : "s"}{k.late.length ? `, ${k.late.length} older than a day` : ""}. Stock value {money(state, k.stockValue)}.</p></div><Link className="erp-btn erp-btn-primary erp-btn-sm" href="/demo/fulfilment">Open the queue <ArrowRight size={14} /></Link></div>
      <div className="erp-rows">{k.toShip.slice(0, 6).map((order) => <div key={order.id} className="erp-row" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1.4fr) 120px 110px" }}>
        <strong>{order.number}</strong><span>{customerName(state, order.customerId)}<small>{units(order)} items · {age(order.createdAt)}</small></span><span><Badge tone={channelTone(order.channel)}>{order.channel}</Badge></span><span><Badge tone="info">{order.status === "New" ? "To pick" : order.status === "Picked" ? "To pack" : "To ship"}</Badge></span>
      </div>)}</div>
    </section>
  </>;
}
