import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo";
import "../demo/(erp)/erp.css";
import "./app.css";

export const metadata: Metadata = pageMetadata("App", "Your BOH ERP workspace.", "/app", { indexable: false });

/** The signed-in product. Same enterprise theme as the demo; data comes from Supabase, not the browser. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <div className="erp app-frame" data-density="comfortable">
    {children}
  </div>;
}
