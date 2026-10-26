import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { DemoWorkspace } from "@/components/demo/demo-workspace";
import { DemoConfigurationProvider } from "@/components/demo/configuration-context";
import { DemoBusinessRecordsProvider } from "@/components/demo/business-records-context";
import { DemoCommunityProvider } from "@/components/demo/community-context";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata("Classic demo workspace", "Explore synthetic company, engineering, and production records in the BOH ERP demonstration workspace.", "/demo/classic", { indexable: false });

export default function DemoLayout({ children }: { children: ReactNode }) {
  return <DemoBusinessRecordsProvider><DemoCommunityProvider><DemoConfigurationProvider><Suspense fallback={<div role="status" style={{ padding: 24, color: "#5B616E", fontSize: 12 }}>Loading BOH ERP demo workspace…</div>}><DemoWorkspace>{children}</DemoWorkspace></Suspense></DemoConfigurationProvider></DemoCommunityProvider></DemoBusinessRecordsProvider>;
}
