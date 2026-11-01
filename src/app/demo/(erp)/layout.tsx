import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { Nunito } from "next/font/google";
import { ErpShell } from "@/components/erp/shell";
import { pageMetadata } from "@/lib/seo";
import "./erp.css";
import "./studio.css";

// Studio theme typeface; the classic theme keeps the website's Space Grotesk + Manrope.
const studio = Nunito({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700", "800"], variable: "--font-studio", display: "swap" });

export const metadata: Metadata = pageMetadata("Demo", "Enter a project once and see BOH ERP connect it across sales, engineering, procurement, production, quality, dispatch and finance.", "/demo", { indexable: false });

export default function ErpDemoLayout({ children }: { children: ReactNode }) {
  return <div className={studio.variable} style={{ display: "contents" }}>
    <Suspense fallback={<div role="status" style={{ minHeight: "100vh", padding: 32, color: "#4B3F8F", background: "linear-gradient(135deg, #CFC4F5, #F6E3EC)" }}>Loading the BOH ERP demo…</div>}><ErpShell>{children}</ErpShell></Suspense>
  </div>;
}
