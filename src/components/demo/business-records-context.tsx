"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { activity, parts as seedParts, productionOrders as seedOrders, type ActivityEvent, type Part, type ProductionOrder } from "@/lib/demo-data";
import { demoFinanceEntries as seedFinance, demoMaterialLots as seedLots, demoSuppliers as seedSuppliers, type DemoSupplier, type FinanceEntry, type MaterialLot } from "@/lib/business-data";

const STORAGE_KEY = "proteus-demo-business-records-v1";

type DemoBusinessRecords = {
  parts: Part[];
  productionOrders: ProductionOrder[];
  suppliers: DemoSupplier[];
  materialLots: MaterialLot[];
  financeEntries: FinanceEntry[];
  activity: ActivityEvent[];
};

type ContextValue = DemoBusinessRecords & {
  ready: boolean;
  setParts: (items: Part[]) => void;
  setProductionOrders: (items: ProductionOrder[]) => void;
  setSuppliers: (items: DemoSupplier[]) => void;
  setMaterialLots: (items: MaterialLot[]) => void;
  setFinanceEntries: (items: FinanceEntry[]) => void;
  addActivity: (event: Omit<ActivityEvent, "id" | "date" | "actor"> & { actor?: string }) => void;
};

function seedRecords(): DemoBusinessRecords {
  return {
    parts: seedParts.map((item) => ({ ...item, revisionHistory: item.revisionHistory.map((revision) => ({ ...revision })) })),
    productionOrders: seedOrders.map((item) => ({ ...item, documentIds: [...item.documentIds], materialLotIds: [...(item.materialLotIds ?? [])] })),
    suppliers: seedSuppliers.map((item) => ({ ...item, categories: [...item.categories] })),
    materialLots: seedLots.map((item) => ({ ...item, partIds: [...item.partIds], orderIds: [...item.orderIds] })),
    financeEntries: seedFinance.map((item) => ({ ...item })),
    activity: activity.map((item) => ({ ...item })),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function strings(value: unknown) { return Array.isArray(value) && value.every((item) => typeof item === "string"); }

function validRecords(value: unknown): value is DemoBusinessRecords {
  if (!isObject(value)) return false;
  const validParts = Array.isArray(value.parts) && value.parts.every((item) => isObject(item) && typeof item.id === "string" && typeof item.number === "string" && typeof item.name === "string" && typeof item.material === "string" && typeof item.currentRevision === "string" && Array.isArray(item.revisionHistory));
  const validOrders = Array.isArray(value.productionOrders) && value.productionOrders.every((item) => isObject(item) && typeof item.id === "string" && typeof item.number === "string" && typeof item.partId === "string" && Number.isFinite(item.quantity) && Array.isArray(item.documentIds));
  const validSuppliers = Array.isArray(value.suppliers) && value.suppliers.every((item) => isObject(item) && typeof item.id === "string" && typeof item.name === "string" && strings(item.categories));
  const validLots = Array.isArray(value.materialLots) && value.materialLots.every((item) => isObject(item) && typeof item.id === "string" && typeof item.code === "string" && Number.isFinite(item.available) && Number.isFinite(item.reserved) && strings(item.partIds) && strings(item.orderIds));
  const validFinance = Array.isArray(value.financeEntries) && value.financeEntries.every((item) => isObject(item) && typeof item.id === "string" && typeof item.invoice === "string" && Number.isFinite(item.amountCents));
  const validActivity = Array.isArray(value.activity) && value.activity.every((item) => isObject(item) && typeof item.id === "string" && typeof item.title === "string" && typeof item.recordId === "string");
  return validParts && validOrders && validSuppliers && validLots && validFinance && validActivity;
}

const BusinessRecordsContext = createContext<ContextValue | null>(null);

export function DemoBusinessRecordsProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<DemoBusinessRecords>(seedRecords);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const load = () => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (validRecords(parsed)) setRecords(parsed);
        }
      } catch {
        console.warn("BOH ERP sample business records could not be read from this browser.");
      } finally {
        setReady(true);
      }
    };
    load();
    const sync = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      try {
        if (event.newValue) {
          const parsed: unknown = JSON.parse(event.newValue);
          if (validRecords(parsed)) setRecords(parsed);
        } else setRecords(seedRecords());
      } catch { /* Keep the last valid in-memory records. */ }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); }
    catch { console.warn("BOH ERP sample business records could not be saved to this browser."); }
  }, [records, ready]);

  const setParts = useCallback((items: Part[]) => setRecords((current) => ({ ...current, parts: items })), []);
  const setProductionOrders = useCallback((items: ProductionOrder[]) => setRecords((current) => ({ ...current, productionOrders: items })), []);
  const setSuppliers = useCallback((items: DemoSupplier[]) => setRecords((current) => ({ ...current, suppliers: items })), []);
  const setMaterialLots = useCallback((items: MaterialLot[]) => setRecords((current) => ({ ...current, materialLots: items })), []);
  const setFinanceEntries = useCallback((items: FinanceEntry[]) => setRecords((current) => ({ ...current, financeEntries: items })), []);
  const addActivity = useCallback((event: Omit<ActivityEvent, "id" | "date" | "actor"> & { actor?: string }) => {
    const now = new Date();
    const stamp = `${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/Berlin" }).format(now)} · ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(now)}`;
    setRecords((current) => ({ ...current, activity: [{ ...event, id: `evt-${crypto.randomUUID()}`, date: stamp, actor: event.actor ?? "Demo user" }, ...current.activity] }));
  }, []);

  const value = useMemo<ContextValue>(() => ({ ...records, ready, setParts, setProductionOrders, setSuppliers, setMaterialLots, setFinanceEntries, addActivity }), [records, ready, setParts, setProductionOrders, setSuppliers, setMaterialLots, setFinanceEntries, addActivity]);
  return <BusinessRecordsContext.Provider value={value}>{children}</BusinessRecordsContext.Provider>;
}

export function useDemoBusinessRecords() {
  const context = useContext(BusinessRecordsContext);
  if (!context) throw new Error("useDemoBusinessRecords must be used inside DemoBusinessRecordsProvider");
  return context;
}
