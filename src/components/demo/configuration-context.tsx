"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { documents as seedDocuments } from "@/lib/demo-data";
import { CONFIG_STORAGE_KEY, LEGACY_TYPE_ID_BY_NAME, createSeedConfiguration, isDemoConfigurationState, type ConfiguredDocumentRule, type ConfiguredDocumentType, type ConfiguredWorkflow, type DemoConfigurationState, type DemoDocumentRecord } from "@/lib/configuration-model";
import type { EngineeringDocument } from "@/lib/demo-data";

type DemoConfigurationContextValue = {
  state: DemoConfigurationState;
  ready: boolean;
  notice: string;
  documents: EngineeringDocument[];
  documentTypes: ConfiguredDocumentType[];
  workflows: ConfiguredWorkflow[];
  rules: ConfiguredDocumentRule[];
  setDocumentTypes: (types: ConfiguredDocumentType[]) => void;
  removeDocumentType: (id: string) => void;
  setWorkflows: (workflows: ConfiguredWorkflow[]) => void;
  setRules: (rules: ConfiguredDocumentRule[]) => void;
  addDocument: (document: DemoDocumentRecord) => void;
  resetDemoConfiguration: () => void;
  documentTypeFor: (document: EngineeringDocument) => ConfiguredDocumentType | undefined;
};

const serverSeedConfiguration = createSeedConfiguration();

type InternalConfigurationContext = Omit<DemoConfigurationContextValue, "state" | "documents" | "documentTypes" | "workflows" | "rules" | "documentTypeFor"> & {
  snapshot: DemoConfigurationState;
};
const InternalContext = createContext<InternalConfigurationContext | null>(null);

export function DemoConfigurationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoConfigurationState>(() => createSeedConfiguration());
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CONFIG_STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        // localStorage is unavailable during SSR; hydrate once on the client.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (isDemoConfigurationState(parsed)) setState(parsed);
        else setNotice("Saved demo settings were incomplete or from an older version. The seed configuration has been restored.");
      }
    } catch {
      setNotice("Saved demo settings could not be read. The seed configuration has been restored.");
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Keep the in-memory demo usable if browser storage is unavailable.
      console.warn("BOH ERP demo configuration could not be saved to browser storage.");
    }
  }, [state, ready]);

  const setDocumentTypes = useCallback((types: ConfiguredDocumentType[]) => setState((current) => ({ ...current, documentTypes: types })), []);
  const removeDocumentType = useCallback((id: string) => setState((current) => ({
    ...current,
    documentTypes: current.documentTypes.filter((type) => type.id !== id),
    rules: current.rules.filter((rule) => rule.documentTypeId !== id),
    workflows: current.workflows.map((workflow) => workflow.documentTypeId === id ? { ...workflow, documentTypeId: null } : workflow),
    createdDocuments: current.createdDocuments.filter((document) => document.typeId !== id),
  })), []);
  const setWorkflows = useCallback((workflows: ConfiguredWorkflow[]) => setState((current) => ({ ...current, workflows })), []);
  const setRules = useCallback((rules: ConfiguredDocumentRule[]) => setState((current) => ({ ...current, rules })), []);
  const addDocument = useCallback((document: DemoDocumentRecord) => setState((current) => ({ ...current, createdDocuments: [document, ...current.createdDocuments] })), []);
  const resetDemoConfiguration = useCallback(() => {
    setState(createSeedConfiguration());
    try { window.localStorage.removeItem("proteus-demo-opportunities-v1"); } catch { /* Reset remains available if browser storage is restricted. */ }
    setNotice("Seed configuration and sample records have been restored in this browser.");
  }, []);

  const value = useMemo<InternalConfigurationContext>(() => ({
    snapshot: state,
    ready,
    notice,
    setDocumentTypes,
    removeDocumentType,
    setWorkflows,
    setRules,
    addDocument,
    resetDemoConfiguration,
  }), [state, ready, notice, setDocumentTypes, removeDocumentType, setWorkflows, setRules, addDocument, resetDemoConfiguration]);

  return <InternalContext.Provider value={value}>{children}</InternalContext.Provider>;
}

export function useDemoConfiguration() {
  const context = useContext(InternalContext);
  if (!context) throw new Error("useDemoConfiguration must be used inside DemoConfigurationProvider");
  const subscribe = useCallback(() => () => {}, []);
  const getSnapshot = useCallback(() => context.snapshot, [context.snapshot]);
  const getServerSnapshot = useCallback(() => serverSeedConfiguration, []);
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const allDocuments = useMemo(() => [...seedDocuments, ...state.createdDocuments], [state.createdDocuments]);
  const documentTypeFor = useCallback((document: EngineeringDocument) => {
    const typeId = "typeId" in document ? document.typeId : undefined;
    const legacyTypeId = LEGACY_TYPE_ID_BY_NAME[document.type];
    return state.documentTypes.find((type) => type.id === (typeId ?? legacyTypeId)) ?? state.documentTypes.find((type) => type.name === document.type);
  }, [state.documentTypes]);
  return {
    ...context,
    state,
    documents: allDocuments,
    documentTypes: state.documentTypes,
    workflows: state.workflows,
    rules: state.rules,
    documentTypeFor,
  };
}
