import type { Metadata, Viewport } from "next";
import { ExpoShell } from "@/components/expo/expo-shell";
import { pageMetadata } from "@/lib/seo";
import "./expo.css";

export const metadata: Metadata = pageMetadata("Expo CRM", "Field notes for trade-show conversations.", "/expo", { indexable: false });
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#211D45" };

/** Phone app for recording trade-show conversations. Not linked from the site; data needs a sign-in. */
export default function ExpoPage() {
  return <div className="xp" data-no-translate><ExpoShell /></div>;
}
