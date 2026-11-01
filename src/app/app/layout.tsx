import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo";
import "../demo/(erp)/erp.css";
import "../demo/(erp)/studio.css";
import "./app.css";

export const metadata: Metadata = pageMetadata("App", "Your BOH ERP workspace.", "/app", { indexable: false });

/** The signed-in product. Same Studio look as the demo; data comes from Supabase, not the browser. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <div className="erp app-frame" data-theme="studio" data-accent="lavender" data-sidebar="lavender" data-density="comfortable" data-corners="rounded" data-nav="left" data-font="brand">
    {children}
  </div>;
}
