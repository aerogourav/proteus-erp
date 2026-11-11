import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { ErpShell } from "@/components/erp/shell";
import { pageMetadata } from "@/lib/seo";
import "./erp.css";

export const metadata: Metadata = pageMetadata("Demo", "Enter a project once and see BOH ERP connect it across sales, engineering, procurement, production, quality, dispatch and finance.", "/demo", { indexable: false });

export default function ErpDemoLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="erp"><div role="status" className="erp-content erp-faint">Loading the BOH ERP demo…</div></div>}><ErpShell>{children}</ErpShell></Suspense>;
}
