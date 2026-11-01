/**
 * Sample company for the e-commerce / wholesale pack: Fjord & Fern Home Goods, a homeware brand selling through its
 * webshop, a marketplace and wholesale to shops. Two months of orders are played through the real rules
 * (pick, pack, ship, return), so stock, invoices and figures agree. All fictional and deterministic.
 */
import { createInitialState, nextId, saveSupplier, type EmailRecord, type ErpState, type SalesChannel } from "./model.ts";
import { addEmails } from "./mail.ts";
import { markPayslipPaid, runPayroll, saveBill, markBillPaid } from "./finance.ts";
import { saveEmployee, setCurrentUser } from "./shopfloor.ts";
import { adjustStock, advanceShopOrder, cancelShopOrder, createShopOrder, returnShopOrder, saveProduct } from "./commerce.ts";
import { PACKS } from "./packs.ts";

/** Small deterministic random generator, so every visitor sees the same sample company. */
export function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createCommerceDemoState(now: string): ErpState {
  const base = Date.parse(now);
  const iso = (daysAgo: number, hour = 10, minute = 0) => new Date(base - daysAgo * 86400000 + (hour - 12) * 3600000 + minute * 60000).toISOString();
  const day = (daysAgo: number) => iso(daysAgo).slice(0, 10);
  const random = seededRandom(20261101);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(random() * list.length)]!;
  let state = createInitialState();
  state = { ...state, settings: { ...state.settings, industry: "commerce", companyName: PACKS.commerce.company, paymentTermsDays: 14 } };

  /* People */
  const people = [
    { code: "E-2001", name: "Maja Lindholm", role: "Founder and managing director", department: "Management", email: "maja@fjordfern.example", hourlyRate: 38, monthlySalary: 4200, pay: "salary" as const },
    { code: "E-2002", name: "Tobias Brandt", role: "Warehouse lead", department: "Fulfilment", email: "tobias@fjordfern.example", hourlyRate: 24, monthlySalary: 2800, pay: "salary" as const },
    { code: "E-2003", name: "Ana Petrović", role: "Customer service", department: "Customer service", email: "ana@fjordfern.example", hourlyRate: 22, monthlySalary: 2600, pay: "salary" as const },
    { code: "E-2004", name: "Lukas Meier", role: "Wholesale and purchasing", department: "Sales", email: "lukas@fjordfern.example", hourlyRate: 28, monthlySalary: 3200, pay: "salary" as const },
    { code: "E-2005", name: "Hana Sato", role: "Packer (part-time)", department: "Fulfilment", email: "", hourlyRate: 15, monthlySalary: 1100, pay: "salary" as const },
  ];
  for (const person of people) state = saveEmployee(state, null, { ...person, active: true, joinedAt: "2025-02-01" }, iso(150));
  state = setCurrentUser(state, state.employees.find((item) => item.code === "E-2002")?.id ?? null);

  /* Suppliers, warehouses, products */
  const suppliers = [
    { name: "Lindqvist Ceramics AB", contact: "Elin Lindqvist", email: "orders@lindqvist-ceramics.example", leadTimeDays: 21 },
    { name: "Baltic Linen Mill", contact: "Rasa Petraitė", email: "sales@baltic-linen.example", leadTimeDays: 14 },
    { name: "Holzwerk Eiche GmbH", contact: "Karl Huber", email: "info@holzwerk-eiche.example", leadTimeDays: 10 },
    { name: "Nordisk Wool Co.", contact: "Sigrid Holm", email: "trade@nordisk-wool.example", leadTimeDays: 18 },
    { name: "Lumen Candle Works", contact: "Paul Girard", email: "b2b@lumen-candles.example", leadTimeDays: 7 },
  ];
  for (const supplier of suppliers) state = saveSupplier(state, null, supplier, iso(140));
  const supplierId = (name: string) => state.suppliers.find((item) => item.name === name)?.id ?? null;
  for (const [code, name] of [["HH", "Hamburg warehouse"], ["BER", "Berlin store stockroom"]] as const) {
    const [id, next] = nextId(state, "wh");
    state = { ...next, warehouses: [...next.warehouses, { id, code, name }] };
  }
  const [hh, ber] = state.warehouses.map((item) => item.id) as [string, string];
  const catalogue = [
    { sku: "MUG-FJD", name: "Stoneware mug", variant: "Fjord blue", category: "Kitchen", price: 18, cost: 6.2, supplier: "Lindqvist Ceramics AB", hh: 420, ber: 40, reorder: 60 },
    { sku: "MUG-CHK", name: "Stoneware mug", variant: "Chalk", category: "Kitchen", price: 18, cost: 6.2, supplier: "Lindqvist Ceramics AB", hh: 380, ber: 30, reorder: 60 },
    { sku: "VAS-TAL", name: "Ceramic vase", variant: "Tall · Sand", category: "Living", price: 54, cost: 19.5, supplier: "Lindqvist Ceramics AB", hh: 140, ber: 10, reorder: 20 },
    { sku: "NAP-SGE", name: "Linen napkins, set of 4", variant: "Sage", category: "Table", price: 32, cost: 11, supplier: "Baltic Linen Mill", hh: 260, ber: 20, reorder: 40 },
    { sku: "NAP-SND", name: "Linen napkins, set of 4", variant: "Sand", category: "Table", price: 32, cost: 11, supplier: "Baltic Linen Mill", hh: 180, ber: 12, reorder: 40 },
    { sku: "TCL-OAT", name: "Linen tablecloth", variant: "Oat · 160 × 250", category: "Table", price: 89, cost: 31, supplier: "Baltic Linen Mill", hh: 90, ber: 6, reorder: 15 },
    { sku: "BRD-S", name: "Oak serving board", variant: "Small", category: "Kitchen", price: 39, cost: 14, supplier: "Holzwerk Eiche GmbH", hh: 220, ber: 15, reorder: 30 },
    { sku: "BRD-L", name: "Oak serving board", variant: "Large", category: "Kitchen", price: 59, cost: 21, supplier: "Holzwerk Eiche GmbH", hh: 160, ber: 10, reorder: 25 },
    { sku: "THR-MOS", name: "Wool throw", variant: "Moss", category: "Living", price: 129, cost: 52, supplier: "Nordisk Wool Co.", hh: 90, ber: 8, reorder: 12 },
    { sku: "THR-OAT", name: "Wool throw", variant: "Oat", category: "Living", price: 129, cost: 52, supplier: "Nordisk Wool Co.", hh: 70, ber: 4, reorder: 12 },
    { sku: "CND-PIN", name: "Scented candle", variant: "Pine & cedar", category: "Living", price: 24, cost: 7.5, supplier: "Lumen Candle Works", hh: 460, ber: 35, reorder: 50 },
    { sku: "CND-FIG", name: "Scented candle", variant: "Fig leaf", category: "Living", price: 24, cost: 7.5, supplier: "Lumen Candle Works", hh: 400, ber: 25, reorder: 50 },
  ];
  for (const item of catalogue) state = saveProduct(state, null, { sku: item.sku, name: item.name, variant: item.variant, category: item.category, price: item.price, cost: item.cost, reorderLevel: item.reorder, supplierId: supplierId(item.supplier), active: true, stock: { [hh]: item.hh, [ber]: item.ber } }, iso(130));
  const product = (sku: string) => state.products.find((item) => item.sku === sku)!.id;

  /* Two months of orders, played through the real flow */
  const shoppers = [["Clara Becker", "DE"], ["Jonas Wolf", "DE"], ["Emma Schulz", "AT"], ["Noah Fischer", "DE"], ["Sofie Jensen", "DK"], ["Liam Weber", "DE"], ["Mia Hoffmann", "CH"], ["Elias Koch", "DE"], ["Lea Richter", "DE"], ["Paul Klein", "NL"], ["Lina Wagner", "DE"], ["Ben Schröder", "DE"]] as const;
  const shops = [["Hafen Concept Store"], ["Kaufhaus Weber"], ["Studio Nord Interiors"]] as const;
  const skus = catalogue.map((item) => item.sku);
  const place = (daysAgo: number, channel: SalesChannel, customer: string, contact: string, country: string, lines: { sku: string; quantity: number }[], warehouse = hh) => {
    const result = createShopOrder(state, { channel, customer, contact, country, warehouseId: warehouse, lines: lines.map((line) => ({ productId: product(line.sku), quantity: line.quantity })), shipping: channel === "Wholesale" ? 0 : channel === "Retail store" ? 0 : 4.9 }, iso(daysAgo, 9 + Math.floor(random() * 9), Math.floor(random() * 60)));
    state = result.state;
    return result.id;
  };
  const ship = (id: string | null, daysAgo: number, deliver = true) => {
    if (!id) return;
    state = advanceShopOrder(state, id, iso(daysAgo, 11));
    // A sample order that could not be picked (stock ran out) is cancelled, as a shop would.
    if (state.shopOrders.find((order) => order.id === id)?.status === "New") { state = cancelShopOrder(state, id, iso(daysAgo, 11)); return; }
    state = advanceShopOrder(state, id, iso(daysAgo, 13));
    state = advanceShopOrder(state, id, iso(daysAgo, 16));
    if (deliver && daysAgo > 2) state = advanceShopOrder(state, id, iso(daysAgo - 2, 12));
  };
  /** On the 1st of each month the warehouse is topped up; each supplier sends one bill for what it delivered. */
  const restock = (daysAgo: number) => {
    const bySupplier = new Map<string, number>();
    for (const item of catalogue) {
      const current = state.products.find((entry) => entry.sku === item.sku)!;
      for (const [warehouse, target] of [[hh, item.hh], [ber, item.ber]] as const) {
        const missing = target - (current.stock[warehouse] ?? 0);
        if (missing <= 0) continue;
        state = adjustStock(state, current.id, warehouse, missing, "Goods receipt", iso(daysAgo, 8));
        bySupplier.set(item.supplier, (bySupplier.get(item.supplier) ?? 0) + missing * item.cost);
      }
    }
    for (const [supplier, net] of bySupplier) {
      const number = `${supplier.split(" ")[0]!.slice(0, 3).toUpperCase()}-${day(daysAgo).replace(/-/g, "").slice(2, 8)}`;
      state = saveBill(state, null, { number, supplier, category: "Stock purchases", date: day(daysAgo), dueDate: day(daysAgo - 30), currency: "EUR", net: Math.round(net * 100) / 100, taxRate: 19, description: "Monthly restock" }, iso(daysAgo, 8));
      const saved = state.bills.find((entry) => entry.number === number);
      if (saved && daysAgo > 30) state = markBillPaid(state, saved.id, true, iso(daysAgo - 25));
    }
  };
  for (let daysAgo = 120; daysAgo >= 3; daysAgo -= 1) {
    if (day(daysAgo).endsWith("-01")) restock(daysAgo);
    // Growing shop: more orders in recent weeks.
    const count = 2 + Math.floor(random() * (daysAgo < 45 ? 4 : 3));
    for (let i = 0; i < count; i += 1) {
      const [name, country] = pick(shoppers);
      const channel: SalesChannel = random() < 0.62 ? "Webshop" : "Marketplace";
      const lines = [{ sku: pick(skus), quantity: 1 + Math.floor(random() * 2) }, ...(random() < 0.55 ? [{ sku: pick(skus), quantity: 1 + Math.floor(random() * 2) }] : []), ...(random() < 0.2 ? [{ sku: pick(["THR-MOS", "THR-OAT", "TCL-OAT", "VAS-TAL"]), quantity: 1 }] : [])];
      const id = place(daysAgo, channel, name, `${name.split(" ")[0]!.toLowerCase()}@mail.example`, country, lines);
      ship(id, Math.max(1, daysAgo - 1));
    }
    if (daysAgo % 2 === 0) {
      const [shop] = pick(shops);
      const id = place(daysAgo, "Wholesale", shop, `einkauf@${shop.split(" ")[0]!.toLowerCase()}.example`, "DE", [{ sku: pick(["MUG-FJD", "MUG-CHK"]), quantity: 24 }, { sku: pick(["CND-PIN", "CND-FIG"]), quantity: 24 }, { sku: pick(["NAP-SGE", "BRD-S", "BRD-L", "VAS-TAL"]), quantity: 12 }, ...(random() < 0.5 ? [{ sku: pick(["THR-MOS", "TCL-OAT"]), quantity: 4 }] : [])]);
      ship(id, Math.max(1, daysAgo - 2));
    }
    if (daysAgo % 6 === 0) ship(place(daysAgo, "Retail store", "Walk-in customers (Berlin store)", "", "DE", [{ sku: pick(skus), quantity: 2 }, { sku: pick(skus), quantity: 1 }], ber), daysAgo, false);
  }
  // Two returns from last month's deliveries.
  // Returns from recent deliveries, so the 30-day return rate is real.
  const delivered = state.shopOrders.filter((order) => order.status === "Delivered" && order.channel !== "Wholesale");
  for (const [back, reason, restock, daysAgo] of [[30, "Colour different from photo", true, 18], [22, "Arrived damaged", false, 12], [12, "Changed my mind", true, 6], [6, "Wrong size ordered", true, 3]] as const) {
    const order = delivered[delivered.length - back];
    if (order) state = returnShopOrder(state, order.id, reason, restock, iso(daysAgo, 15));
  }
  // Wholesale accounts pay on 14-day terms; one shop is late.
  state = { ...state, invoices: state.invoices.map((invoice) => {
    if (invoice.paidAt || invoice.dueAt >= day(0)) return invoice;
    const lateShop = state.customers.find((item) => item.name === "Kaufhaus Weber")?.id;
    if (invoice.customerId === lateShop && invoice.dueAt >= day(10)) return invoice;
    return { ...invoice, paidAt: invoice.dueAt };
  }) };

  /* Today's work: orders at every step, one blocked by stock */
  state = adjustStock(state, product("THR-OAT"), hh, -Math.max(0, (state.products.find((item) => item.sku === "THR-OAT")!.stock[hh] ?? 0) - 3), "Stock count", iso(2, 18));
  state = adjustStock(state, product("NAP-SND"), hh, -Math.max(0, (state.products.find((item) => item.sku === "NAP-SND")!.stock[hh] ?? 0) - 9), "Stock count", iso(2, 18));
  const shipped = place(2, "Webshop", "Sofie Jensen", "sofie@mail.example", "DK", [{ sku: "VAS-TAL", quantity: 1 }]);
  if (shipped) { state = advanceShopOrder(state, shipped, iso(1, 10)); state = advanceShopOrder(state, shipped, iso(1, 11)); state = advanceShopOrder(state, shipped, iso(1, 15)); }
  const packed = place(1, "Marketplace", "Paul Klein", "paul@mail.example", "NL", [{ sku: "BRD-L", quantity: 1 }, { sku: "CND-FIG", quantity: 2 }]);
  if (packed) { state = advanceShopOrder(state, packed, iso(0, 9)); state = advanceShopOrder(state, packed, iso(0, 10)); }
  const picked = place(1, "Webshop", "Clara Becker", "clara@mail.example", "DE", [{ sku: "MUG-CHK", quantity: 4 }]);
  if (picked) state = advanceShopOrder(state, picked, iso(0, 9, 30));
  place(0, "Webshop", "Lea Richter", "lea@mail.example", "DE", [{ sku: "NAP-SGE", quantity: 2 }, { sku: "CND-PIN", quantity: 1 }]);
  place(0, "Marketplace", "Elias Koch", "elias@mail.example", "DE", [{ sku: "THR-MOS", quantity: 1 }]);
  place(0, "Wholesale", "Studio Nord Interiors", "einkauf@studio.example", "DE", [{ sku: "THR-OAT", quantity: 6 }, { sku: "NAP-SND", quantity: 12 }]);

  /* Bills and payroll */
  const bills = [
    ...[120, 90, 60, 30, 1].flatMap((daysAgo) => {
      const month = day(daysAgo).slice(0, 7);
      return [
        { number: `DHL-${month}`, supplier: "DHL Paket", category: "Shipping and fulfilment" as const, daysAgo, net: 1180 + Math.round(random() * 300), paid: daysAgo > 20, description: `Parcel shipping, ${month}` },
        { number: `ADS-${month}`, supplier: "Social ads", category: "Marketing" as const, daysAgo, net: 800 + Math.round(random() * 400), paid: daysAgo > 5, description: `Paid social, ${month}` },
        { number: `SHOP-${month}`, supplier: "Webshop platform", category: "Software and hosting" as const, daysAgo, net: 189, paid: daysAgo > 5, description: "Shop subscription and apps" },
        { number: `MIETE-${month}`, supplier: "Lagerhaus Hamburg", category: "Rent and utilities" as const, daysAgo, net: 2100, paid: daysAgo > 5, description: `Warehouse rent, ${month}` },
      ];
    }),
  ];
  for (const bill of bills) {
    state = saveBill(state, null, { number: bill.number, supplier: bill.supplier, category: bill.category, date: day(bill.daysAgo), dueDate: day(bill.daysAgo - 14), currency: "EUR", net: bill.net, taxRate: 19, description: bill.description }, iso(bill.daysAgo));
    const saved = state.bills.find((item) => item.number === bill.number);
    if (saved && bill.paid) state = markBillPaid(state, saved.id, true, iso(bill.daysAgo - 10));
  }
  for (const monthsAgo of [4, 3, 2, 1]) {
    const d = new Date(base); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - monthsAgo);
    const period = d.toISOString().slice(0, 7);
    state = runPayroll(state, period, `${period}-28T10:00:00.000Z`);
    for (const slip of state.payslips.filter((item) => item.period === period)) state = markPayslipPaid(state, slip.id, true, `${period}-28T12:00:00.000Z`);
  }

  /* Inbox */
  const emails: EmailRecord[] = [
    { id: "cm-mail-1", folder: "inbox", from: "lea@mail.example", fromName: "Lea Richter", to: "hello@fjordfern.example", subject: "Gift wrapping for my order?", date: iso(0, 9, 40), read: false, source: "demo", body: "Hi! I just ordered two napkin sets and a candle. Could you gift-wrap them? It's a birthday present.\n\nThanks, Lea" },
    { id: "cm-mail-2", folder: "inbox", from: "einkauf@studio.example", fromName: "Studio Nord Interiors", to: "hello@fjordfern.example", subject: "Wool throws: when can you deliver 6 in oat?", date: iso(0, 8, 15), read: false, source: "demo", body: "Hello Lukas,\n\nwe placed an order for 6 oat wool throws and 12 sand napkin sets. Our shop reopens on the 15th. Can you confirm a delivery date?\n\nBest, Studio Nord" },
    { id: "cm-mail-3", folder: "inbox", from: "trade@nordisk-wool.example", fromName: "Nordisk Wool Co.", to: "hello@fjordfern.example", subject: "Winter collection: oat throws back in stock", date: iso(1, 14, 5), read: true, source: "demo", body: "Dear Fjord & Fern team,\n\nthe oat wool throws are back in production. Lead time is 18 days. Let us know your quantities.\n\nSigrid" },
  ];
  state = addEmails(state, emails, iso(0, 9, 45));
  return state;
}
