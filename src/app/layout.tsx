import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Manrope, Nunito, Space_Grotesk } from "next/font/google";
import { siteConfig } from "@/lib/site-config";
import { LanguageProvider } from "@/components/language-provider";
import "./globals.css";
import "./site.css";

const display = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-display", display: "swap" });
const body = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-body", display: "swap" });
// Studio typeface for the website and the ERP demo; Space Grotesk + Manrope remain for the classic ERP theme.
const studio = Nunito({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700", "800"], variable: "--font-studio", display: "swap" });

export const metadata: Metadata = {
  metadataBase: siteConfig.publicUrl ? new URL(siteConfig.publicUrl) : undefined,
  title: { default: "BOH ERP — Your business. Your workflows. Your ERP.", template: "%s | BOH ERP" },
  description: "BOH ERP sets up configurable business software around how your company works. Explore the guided demo and talk to us about your workflow.",
  applicationName: "BOH ERP",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${display.variable} ${body.variable} ${studio.variable}`}>
      <body><LanguageProvider>{children}</LanguageProvider></body>
    </html>
  );
}
