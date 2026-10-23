"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Boxes, ClipboardList, FilePlus2, GitBranch, MessageSquareText, Package, Plus, Truck, WalletCards } from "lucide-react";
import { useDemoBusinessRecords } from "@/components/demo/business-records-context";
import { useDemoConfiguration } from "@/components/demo/configuration-context";
import { DocumentCreateDialog } from "@/components/demo/document-create-dialog";
import { FinanceEntryEditor, MaterialLotEditor, PartEditor, ProductionOrderEditor, SupplierEditor } from "@/components/demo/business-record-forms";
import type { DemoSupplier, FinanceEntry, MaterialLot } from "@/lib/business-data";
import type { Part, ProductionOrder } from "@/lib/demo-data";
import styles from "@/components/demo/demo.module.css";

type Action = "document" | "part" | "order" | "supplier" | "material" | "finance";

export function OverviewQuickActions() {
  const { ready: recordsReady, parts, productionOrders, suppliers, materialLots, financeEntries, setParts, setProductionOrders, setSuppliers, setMaterialLots, setFinanceEntries, addActivity } = useDemoBusinessRecords();
  const { ready: configurationReady } = useDemoConfiguration();
  const [activeAction, setActiveAction] = useState<Action | null>(null);
  const [notice, setNotice] = useState("");
  const ready = recordsReady && configurationReady;
  const actions = [
    { id: "document" as const, title: "Create document", detail: "Add an engineering record", icon: FilePlus2 },
    { id: "part" as const, title: "Add part", detail: "Create a part and revision", icon: Boxes },
    { id: "order" as const, title: "New production order", detail: "Plan work for a part", icon: ClipboardList },
    { id: "supplier" as const, title: "Add supplier", detail: "Create a supplier record", icon: Truck },
    { id: "material" as const, title: "Add material lot", detail: "Record synthetic stock", icon: Package },
    { id: "finance" as const, title: "New payment record", detail: "Add a sample transaction", icon: WalletCards },
  ];

  const closeAction = () => setActiveAction(null);
  const savePart = (part: Part) => {
    setParts([part, ...parts]); addActivity({ title: "Part record created", subject: part.number, recordId: part.id, kind: "Part" });
    setActiveAction(null); setNotice(`${part.number} saved in this browser.`);
  };
  const saveOrder = (order: ProductionOrder) => {
    setProductionOrders([order, ...productionOrders]);
    setMaterialLots(materialLots.map((lot) => order.materialLotIds?.includes(lot.id) ? { ...lot, orderIds: [...new Set([...lot.orderIds, order.id])], partIds: [...new Set([...lot.partIds, order.partId])] } : lot));
    addActivity({ title: "Production order created", subject: order.number, recordId: order.id, kind: "Production order" });
    setActiveAction(null); setNotice(`${order.number} saved in this browser.`);
  };
  const saveSupplier = (supplier: DemoSupplier) => {
    setSuppliers([supplier, ...suppliers]); addActivity({ title: "Supplier record created", subject: supplier.name, recordId: supplier.id, kind: "Supplier" });
    setActiveAction(null); setNotice(`${supplier.name} saved in this browser.`);
  };
  const saveMaterial = (lot: MaterialLot) => {
    setMaterialLots([lot, ...materialLots]);
    setProductionOrders(productionOrders.map((order) => lot.orderIds.includes(order.id) ? { ...order, materialLotIds: [...new Set([...(order.materialLotIds ?? []), lot.id])] } : order));
    addActivity({ title: "Raw-material lot created", subject: lot.code, recordId: lot.id, kind: "Raw material" });
    setActiveAction(null); setNotice(`${lot.code} saved in this browser.`);
  };
  const saveFinance = (entry: FinanceEntry) => {
    setFinanceEntries([entry, ...financeEntries]); addActivity({ title: "Payment record created", subject: entry.invoice, recordId: entry.id, kind: "Finance" });
    setActiveAction(null); setNotice(`${entry.invoice} saved in this browser.`);
  };
  const openAction = (action: Action) => {
    if (!ready) { setNotice("The saved demo workspace is still loading. Try again in a moment."); return; }
    setNotice(""); setActiveAction(action);
  };

  return <>
    <section className={styles.card + " " + styles.quickActionsPanel} aria-labelledby="quick-actions-title">
      <header className={styles.quickActionsHead}><div><span className={styles.visualEyebrow}>WORKSPACE SHORTCUTS</span><h2 id="quick-actions-title">Quick actions</h2><p>Start common tasks without leaving the overview.</p></div><span className={styles.quickActionsMark}><Plus size={16} /></span></header>
      {notice && <p className={styles.quickActionsNotice} role="status">{notice}</p>}
      <div className={styles.quickActionList}>{actions.map(({ id, title, detail, icon: Icon }) => <button type="button" key={id} className={styles.quickAction} onClick={() => openAction(id)}><span className={styles.quickActionIcon}><Icon size={15} /></span><span className={styles.quickActionCopy}><strong>{title}</strong><small>{detail}</small></span></button>)}</div>
      <div className={styles.quickActionLinks}><Link href="/demo/community"><span><MessageSquareText size={14} /> Community updates</span><ArrowRight size={13} /></Link><Link href="/demo/configuration?tab=workflows#approval-workflows"><span><GitBranch size={14} /> Manage workflows</span><ArrowRight size={13} /></Link></div>
      <p className={styles.quickActionsFoot}>Synthetic records · saved in this browser</p>
    </section>

    {activeAction === "document" && <DocumentCreateDialog onClose={closeAction} />}
    {activeAction === "part" && <PartEditor onClose={closeAction} onSave={savePart} />}
    {activeAction === "order" && <ProductionOrderEditor onClose={closeAction} onSave={saveOrder} />}
    {activeAction === "supplier" && <SupplierEditor onClose={closeAction} onSave={saveSupplier} />}
    {activeAction === "material" && <MaterialLotEditor onClose={closeAction} onSave={saveMaterial} />}
    {activeAction === "finance" && <FinanceEntryEditor onClose={closeAction} onSave={saveFinance} />}
  </>;
}
