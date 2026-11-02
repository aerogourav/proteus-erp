import type { Metadata } from "next";
import type { ReactNode } from "react";
// Fonts ship with the site (Fontsource, SIL Open Font License): builds never download from Google,
// and visitors' browsers load them from this site only.
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/manrope";
import "@fontsource-variable/nunito";
import { siteConfig } from "@/lib/site-config";
import { LanguageProvider } from "@/components/language-provider";
import "./globals.css";
import "./site.css";

export const metadata: Metadata = {
  metadataBase: siteConfig.publicUrl ? new URL(siteConfig.publicUrl) : undefined,
  title: { default: "BOH ERP — Your business. Your workflows. Your ERP.", template: "%s | BOH ERP" },
  description: "BOH ERP sets up configurable business software around how your company works. Explore the guided demo and talk to us about your workflow.",
  applicationName: "BOH ERP",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body><LanguageProvider>{children}</LanguageProvider></body>
    </html>
  );
}
