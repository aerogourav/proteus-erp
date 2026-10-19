import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "PROTEUS — Business software shaped around your work",
  description:
    "Configure business records, workflows, and operational processes around your company. Explore a synthetic precision-manufacturing demo.",
  applicationName: "PROTEUS",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
