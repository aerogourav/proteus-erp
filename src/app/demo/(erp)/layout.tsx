import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { ErpShell } from "@/components/erp/shell";
import { pageMetadata } from "@/lib/seo";
import "./erp.css";

export const metadata: Metadata = pageMetadata("Demo", "Enter a project once and see BOH ERP connect it across sales, engineering, procurement, production, quality, dispatch and finance.", "/demo", { indexable: false });

export default function ErpDemoLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div role="status" style={{ minHeight: "100vh", padding: 32, color: "#4A5160", background: "#F1EFE8" }}>Loading the BOH ERP demo…</div>}><ErpShell>{children}</ErpShell></Suspense>;
}
