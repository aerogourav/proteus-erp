import type { Metadata } from "next";
import type { ReactNode } from "react";
import { siteConfig } from "@/lib/site-config";
import { LanguageProvider } from "@/components/language-provider";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: siteConfig.publicUrl ? new URL(siteConfig.publicUrl) : undefined,
  title: { default: "PROTEUS — Your business. Your workflows. Your ERP.", template: "%s | PROTEUS" },
  description: "PROTEUS is developing configurable business software shaped around how a company works. Explore the synthetic product demonstration and its current limits.",
  applicationName: "PROTEUS",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body><LanguageProvider>{children}</LanguageProvider></body>
    </html>
  );
}
