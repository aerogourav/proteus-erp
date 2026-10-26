import { Suspense } from "react";
import { DocumentBrowser } from "@/components/demo/record-browsers";
import { PageHeader } from "@/components/demo/demo-ui";

export default function DocumentsPage() {
  return <><PageHeader eyebrow="Engineering control" title="Documents" description="Find the synthetic engineering record connected to each part and production order." meta="RECORDS · SYNTHETIC" /><Suspense fallback={<div role="status">Loading document records…</div>}><DocumentBrowser /></Suspense></>;
}
