import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { DemoWorkspace } from "@/components/demo/demo-workspace";
import { DemoConfigurationProvider } from "@/components/demo/configuration-context";

export const metadata: Metadata = {
  title: "Demo Workspace | PROTEUS",
  description: "Explore synthetic company, engineering, and production records in the PROTEUS demonstration workspace.",
};

export default function DemoLayout({ children }: { children: ReactNode }) {
  return <DemoConfigurationProvider><Suspense fallback={<div role="status" style={{ padding: 24, color: "#536476", fontSize: 12 }}>Loading PROTEUS demo workspace…</div>}><DemoWorkspace>{children}</DemoWorkspace></Suspense></DemoConfigurationProvider>;
}
