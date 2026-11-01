/**
 * Sample company for the software / SaaS pack: Northwind Analytics, a B2B analytics product sold per seat.
 * Fourteen months of sign-ups, upgrades, downgrades, cancellations and billing runs are played through the real
 * rules, so MRR history, churn, invoices and receivables agree. All fictional and deterministic.
 */
import { createInitialState, nextId, saveSupplier, type EmailRecord, type ErpState, type TicketPriority } from "./model.ts";
import { addEmails } from "./mail.ts";
import { markBillPaid, markPayslipPaid, runPayroll, saveBill } from "./finance.ts";
import { saveEmployee, setCurrentUser } from "./shopfloor.ts";
import { cancelSubscription, changeSubscription, convertTrial, createSubscription, createTicket, replyTicket, runBilling, setPastDue, setTicketStatus } from "./saas.ts";
import { PACKS } from "./packs.ts";
import { seededRandom } from "./seed-commerce.ts";

export function createSaasDemoState(now: string): ErpState {
  const base = Date.parse(now);
  const iso = (daysAgo: number, hour = 10) => new Date(base - daysAgo * 86400000 + (hour - 12) * 3600000).toISOString();
  const day = (daysAgo: number) => iso(daysAgo).slice(0, 10);
  const random = seededRandom(424242);
  let state = createInitialState();
  state = { ...state, settings: { ...state.settings, industry: "saas", companyName: PACKS.saas.company, paymentTermsDays: 14 } };

  /* People */
  const people = [
    { code: "E-3001", name: "Priya Raman", role: "CEO and co-founder", department: "Management", email: "priya@northwind.example", hourlyRate: 50, monthlySalary: 6500, pay: "salary" as const },
    { code: "E-3002", name: "Felix Neumann", role: "CTO and co-founder", department: "Engineering", email: "felix@northwind.example", hourlyRate: 50, monthlySalary: 6500, pay: "salary" as const },
    { code: "E-3003", name: "Grace Okafor", role: "Senior engineer", department: "Engineering", email: "grace@northwind.example", hourlyRate: 45, monthlySalary: 5800, pay: "salary" as const },
    { code: "E-3005", name: "Julia Kowalski", role: "Account executive", department: "Sales", email: "julia@northwind.example", hourlyRate: 34, monthlySalary: 4400, pay: "salary" as const },
    { code: "E-3006", name: "Sam Taylor", role: "Customer success and support", department: "Customer success", email: "sam@northwind.example", hourlyRate: 30, monthlySalary: 3800, pay: "salary" as const },
  ];
  for (const person of people) state = saveEmployee(state, null, { ...person, active: true, joinedAt: "2024-06-01" }, iso(420));
  const emp = (code: string) => state.employees.find((item) => item.code === code)?.id ?? null;
  state = setCurrentUser(state, emp("E-3006"));

  /* Suppliers and plans */
  for (const supplier of [
    { name: "CloudScale Hosting", contact: "Billing team", email: "billing@cloudscale.example", leadTimeDays: null },
    { name: "Mailstream", contact: "Accounts", email: "accounts@mailstream.example", leadTimeDays: null },
    { name: "Kanzlei Vogel", contact: "Dr. Vogel", email: "office@kanzlei-vogel.example", leadTimeDays: null },
  ]) state = saveSupplier(state, null, supplier, iso(400));
  for (const plan of [
    { name: "Starter", pricePerSeat: 12, interval: "month" as const, description: "Dashboards and 3 data sources" },
    { name: "Team", pricePerSeat: 39, interval: "month" as const, description: "Unlimited sources, alerts, shared workspaces" },
    { name: "Business", pricePerSeat: 69, interval: "month" as const, description: "SSO, audit log, priority support" },
    { name: "Business (annual)", pricePerSeat: 690, interval: "year" as const, description: "Business, billed yearly, two months free" },
  ]) {
    const [id, next] = nextId(state, "plan");
    state = { ...next, plans: [...next.plans, { id, ...plan }] };
  }
  const plan = (name: string) => state.plans.find((item) => item.name === name)!.id;

  /* Fourteen months of customers */
  type Story = { name: string; contact: string; plan: string; seats: number; startedDaysAgo: number; discount?: number; trial?: number; events?: { daysAgo: number; kind: "seats" | "plan" | "cancel" | "pastdue"; value?: number | string; note?: string }[] };
  const stories: Story[] = [
    { name: "Helios Logistics", contact: "it@helios-logistics.example", plan: "Business", seats: 40, startedDaysAgo: 410, discount: 10, events: [{ daysAgo: 200, kind: "seats", value: 46 }, { daysAgo: 40, kind: "seats", value: 52 }] },
    { name: "Brightwater Retail", contact: "ops@brightwater.example", plan: "Team", seats: 18, startedDaysAgo: 395, events: [{ daysAgo: 150, kind: "plan", value: "Business" }] },
    { name: "Quarry & Co", contact: "finance@quarryco.example", plan: "Team", seats: 9, startedDaysAgo: 380 },
    { name: "Atlas Mobility", contact: "data@atlas-mobility.example", plan: "Business (annual)", seats: 25, startedDaysAgo: 360 },
    { name: "Fernhill Clinics", contact: "admin@fernhill.example", plan: "Team", seats: 14, startedDaysAgo: 340, events: [{ daysAgo: 90, kind: "seats", value: 10, note: "Closed one site" }] },
    { name: "Polar Foods", contact: "bi@polarfoods.example", plan: "Starter", seats: 6, startedDaysAgo: 330, events: [{ daysAgo: 60, kind: "cancel", note: "Moved to an in-house tool" }] },
    { name: "Kite Energy", contact: "analytics@kite-energy.example", plan: "Business", seats: 30, startedDaysAgo: 300, events: [{ daysAgo: 120, kind: "seats", value: 38 }] },
    { name: "Mosaic Studios", contact: "hello@mosaicstudios.example", plan: "Starter", seats: 5, startedDaysAgo: 280, events: [{ daysAgo: 100, kind: "plan", value: "Team" }] },
    { name: "Granite Insurance", contact: "it@granite-ins.example", plan: "Business (annual)", seats: 60, startedDaysAgo: 260, discount: 15 },
    { name: "Little Fox Toys", contact: "owner@littlefox.example", plan: "Starter", seats: 3, startedDaysAgo: 240, events: [{ daysAgo: 30, kind: "cancel", note: "Budget cuts" }] },
    { name: "Vela Payments", contact: "data@velapay.example", plan: "Team", seats: 22, startedDaysAgo: 210, events: [{ daysAgo: 70, kind: "seats", value: 28 }] },
    { name: "Orchard Schools Trust", contact: "it@orchardschools.example", plan: "Team", seats: 30, startedDaysAgo: 190, discount: 20 },
    { name: "Nimbus Travel", contact: "ops@nimbustravel.example", plan: "Team", seats: 12, startedDaysAgo: 170, events: [{ daysAgo: 12, kind: "pastdue" }] },
    { name: "Copperleaf Legal", contact: "office@copperleaf.example", plan: "Business", seats: 15, startedDaysAgo: 150 },
    { name: "Driftwood Hotels", contact: "revenue@driftwood.example", plan: "Team", seats: 16, startedDaysAgo: 130, events: [{ daysAgo: 20, kind: "seats", value: 12, note: "Seasonal staff left" }] },
    { name: "Summit Robotics", contact: "eng@summit-robotics.example", plan: "Business", seats: 20, startedDaysAgo: 110, events: [{ daysAgo: 15, kind: "seats", value: 26 }] },
    { name: "Bluebell Bakery Group", contact: "finance@bluebell.example", plan: "Starter", seats: 4, startedDaysAgo: 95, events: [{ daysAgo: 9, kind: "cancel", note: "Not using it enough" }] },
    { name: "Arcadia Games", contact: "data@arcadia-games.example", plan: "Team", seats: 25, startedDaysAgo: 75 },
    { name: "Tidal Wind Farms", contact: "ops@tidalwind.example", plan: "Business", seats: 18, startedDaysAgo: 50 },
    { name: "Pinecone Media", contact: "hi@pinecone.example", plan: "Team", seats: 8, startedDaysAgo: 25 },
    { name: "Juniper Health", contact: "it@juniperhealth.example", plan: "Business", seats: 35, startedDaysAgo: 12, discount: 10 },
    { name: "Ember Coffee Roasters", contact: "team@embercoffee.example", plan: "Team", seats: 6, startedDaysAgo: 8, trial: 14 },
    { name: "Lattice Architects", contact: "studio@lattice.example", plan: "Business", seats: 12, startedDaysAgo: 5, trial: 14 },
    { name: "Ridgeway Freight", contact: "it@ridgeway.example", plan: "Team", seats: 20, startedDaysAgo: 2, trial: 14 },
  ];
  // Play events in date order across all customers, so history timestamps interleave like real life.
  const ids = new Map<string, string>();
  const timeline = stories.flatMap((story) => [
    { daysAgo: story.startedDaysAgo, run: () => { const result = createSubscription(state, { customer: story.name, contact: story.contact, planId: plan(story.plan), seats: story.seats, discountPct: story.discount ?? 0, trialDays: story.trial ?? 0 }, iso(story.startedDaysAgo)); state = result.state; if (result.id) ids.set(story.name, result.id); } },
    ...(story.events ?? []).map((event) => ({ daysAgo: event.daysAgo, run: () => {
      const id = ids.get(story.name)!;
      const sub = state.subscriptions.find((item) => item.id === id)!;
      if (event.kind === "seats") state = changeSubscription(state, id, { planId: sub.planId, seats: Number(event.value), discountPct: sub.discountPct }, iso(event.daysAgo));
      if (event.kind === "plan") state = changeSubscription(state, id, { planId: plan(String(event.value)), seats: sub.seats, discountPct: sub.discountPct }, iso(event.daysAgo));
      if (event.kind === "cancel") state = cancelSubscription(state, id, event.note ?? "", iso(event.daysAgo));
      if (event.kind === "pastdue") state = setPastDue(state, id, true, iso(event.daysAgo));
    } })),
  ]).sort((a, b) => b.daysAgo - a.daysAgo);
  // Monthly billing runs on the 1st, paid within the month except the latest.
  const months: { period: string; daysAgo: number }[] = [];
  for (let i = 14; i >= 0; i -= 1) {
    const d = new Date(base); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i);
    months.push({ period: d.toISOString().slice(0, 7), daysAgo: Math.round((base - d.getTime()) / 86400000) });
  }
  const events = [...timeline, ...months.map((month) => ({ daysAgo: month.daysAgo - 0.01, run: () => { state = runBilling(state, month.period, iso(month.daysAgo), month.daysAgo > 25).state; } }))].sort((a, b) => b.daysAgo - a.daysAgo);
  for (const event of events) event.run();
  // One trial already converted last week.
  const converted = createSubscription(state, { customer: "Cobalt Labs", contact: "ops@cobaltlabs.example", planId: plan("Team"), seats: 10, discountPct: 0, trialDays: 14 }, iso(20));
  state = converted.state;
  if (converted.id) state = convertTrial(state, converted.id, iso(6));
  // Most of this month's invoices are already paid; a few customers pay on terms.
  state = { ...state, invoices: state.invoices.map((invoice, index) => (!invoice.paidAt && invoice.issuedAt < day(0) && random() < 0.7 && index % 5 !== 0 ? { ...invoice, paidAt: day(Math.max(0, Math.round(random() * 3))) } : invoice)) };

  /* Support */
  const tickets: { customer: string; subject: string; priority: TicketPriority; daysAgo: number; replyAfterHours?: number; solvedDaysAgo?: number; waiting?: boolean; assignee: string }[] = [
    { customer: "Helios Logistics", subject: "SSO login loops for new users", priority: "Urgent", daysAgo: 0.2, assignee: "E-3006" },
    { customer: "Juniper Health", subject: "Onboarding: connect our data warehouse", priority: "High", daysAgo: 1, replyAfterHours: 2, assignee: "E-3006" },
    { customer: "Nimbus Travel", subject: "Invoice for October not received", priority: "Normal", daysAgo: 2, replyAfterHours: 5, waiting: true, assignee: "E-3006" },
    { customer: "Arcadia Games", subject: "Dashboard export to PDF cuts off charts", priority: "Normal", daysAgo: 3, replyAfterHours: 3, assignee: "E-3006" },
    { customer: "Kite Energy", subject: "Request: alert when a metric drops 10%", priority: "Low", daysAgo: 5, replyAfterHours: 20, waiting: true, assignee: "E-3006" },
    { customer: "Summit Robotics", subject: "Add 6 seats for the new team", priority: "Normal", daysAgo: 15, replyAfterHours: 1, solvedDaysAgo: 15, assignee: "E-3005" },
    { customer: "Brightwater Retail", subject: "Data source sync delayed by 2 hours", priority: "High", daysAgo: 6, replyAfterHours: 1.5, solvedDaysAgo: 5, assignee: "E-3006" },
    { customer: "Copperleaf Legal", subject: "Audit log retention period", priority: "Low", daysAgo: 8, replyAfterHours: 6, solvedDaysAgo: 7, assignee: "E-3006" },
    { customer: "Vela Payments", subject: "API rate limit questions", priority: "Normal", daysAgo: 4, replyAfterHours: 4, solvedDaysAgo: 3, assignee: "E-3003" },
    { customer: "Tidal Wind Farms", subject: "Training session for operators", priority: "Low", daysAgo: 10, replyAfterHours: 8, solvedDaysAgo: 6, assignee: "E-3006" },
  ];
  for (const ticket of tickets) {
    const result = createTicket(state, { customer: ticket.customer, contact: "", subject: ticket.subject, priority: ticket.priority, assigneeId: emp(ticket.assignee) }, iso(ticket.daysAgo, 9));
    state = result.state;
    if (!result.id) continue;
    if (ticket.replyAfterHours !== undefined) state = replyTicket(state, result.id, Boolean(ticket.waiting), new Date(Date.parse(iso(ticket.daysAgo, 9)) + ticket.replyAfterHours * 3600000).toISOString());
    if (ticket.solvedDaysAgo !== undefined) state = setTicketStatus(state, result.id, "Solved", iso(ticket.solvedDaysAgo, 16));
  }

  /* Costs */
  const bills = [
    ...[150, 120, 90, 60, 30, 1].flatMap((daysAgo, index) => {
      const month = day(daysAgo).slice(0, 7);
      return [
        { number: `CS-${month}`, supplier: "CloudScale Hosting", category: "Software and hosting" as const, daysAgo, net: 3200 + index * 160, paid: daysAgo > 5, description: `Cloud infrastructure, ${month}` },
        { number: `MS-${month}`, supplier: "Mailstream", category: "Software and hosting" as const, daysAgo, net: 240, paid: daysAgo > 5, description: "Transactional email" },
        { number: `ADS-${month}`, supplier: "Search ads", category: "Marketing" as const, daysAgo, net: 2200 + Math.round(random() * 800), paid: daysAgo > 5, description: `Search campaigns, ${month}` },
        { number: `OFFICE-${month}`, supplier: "Coworking Hafen", category: "Rent and utilities" as const, daysAgo, net: 2900, paid: daysAgo > 5, description: `Office, ${month}` },
      ];
    }),
    { number: "KV-2026-41", supplier: "Kanzlei Vogel", category: "Services" as const, daysAgo: 14, net: 1200, paid: false, description: "Contract review, enterprise template" },
  ];
  for (const bill of bills) {
    state = saveBill(state, null, { number: bill.number, supplier: bill.supplier, category: bill.category, date: day(bill.daysAgo), dueDate: day(bill.daysAgo - 14), currency: "EUR", net: bill.net, taxRate: 19, description: bill.description }, iso(bill.daysAgo));
    const saved = state.bills.find((item) => item.number === bill.number);
    if (saved && bill.paid) state = markBillPaid(state, saved.id, true, iso(Math.max(0, bill.daysAgo - 10)));
  }
  for (const monthsAgo of [5, 4, 3, 2, 1]) {
    const d = new Date(base); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - monthsAgo);
    const period = d.toISOString().slice(0, 7);
    state = runPayroll(state, period, `${period}-28T10:00:00.000Z`);
    for (const slip of state.payslips.filter((item) => item.period === period)) state = markPayslipPaid(state, slip.id, true, `${period}-28T12:00:00.000Z`);
  }

  /* Inbox */
  const emails: EmailRecord[] = [
    { id: "ss-mail-1", folder: "inbox", from: "it@ridgeway.example", fromName: "Ridgeway Freight", to: "hello@northwind.example", subject: "Trial: can we get a call about SSO?", date: iso(0, 9), read: false, source: "demo", body: "Hi team,\n\nwe started a trial two days ago and like it. Before we roll out to 20 people we need SSO. Can we get a call this week?\n\nThanks, Ridgeway IT" },
    { id: "ss-mail-2", folder: "inbox", from: "ops@nimbustravel.example", fromName: "Nimbus Travel", to: "hello@northwind.example", subject: "Payment for our subscription", date: iso(1, 15), read: false, source: "demo", body: "Hello,\n\nsorry for the delay, our finance team changed banks. Payment for the last invoice goes out on Friday.\n\nBest regards, Nimbus Travel" },
  ];
  state = addEmails(state, emails, iso(0, 9));
  return state;
}
