import { ImageResponse } from "next/og";

export const alt = "BOH ERP — Your business. Your workflows. Your ERP.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ink = "#1F0E18";
const paper = "#FBF4EE";
const accent = "#F2566F";

export default function OpenGraphImage() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 76px", color: paper, background: ink, fontFamily: "Arial, sans-serif" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <svg width="64" height="64" viewBox="0 0 100 100">
        <rect width="100" height="100" rx="24" fill="#2E1521" />
        <path d="M38 25C34 34 28 42 18 49C28 45 40 44 52 47Z" fill="#F45470" />
        <circle cx="53.5" cy="31" r="16" fill="#F45470" />
        <path d="M30 78.5C40 76.5 50 76.5 62.5 83.5C54 77 48 70 43.5 56Z" fill="#FFB27E" />
        <circle cx="28.5" cy="62.5" r="16" fill="#FFB27E" />
        <path d="M83.5 56C78 48 74 40 71 29.5C70 39 66 47 58 56Z" fill="#3DB873" />
        <circle cx="70.5" cy="66.5" r="16.5" fill="#3DB873" />
      </svg>
      <div style={{ display: "flex", fontSize: 34, fontWeight: 700, letterSpacing: 1 }}>BOH<span style={{ fontWeight: 400, marginLeft: 10 }}>ERP</span></div>
    </div>
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", flexDirection: "column", fontSize: 72, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
        <span>Your business.</span><span>Your workflows.</span><span style={{ color: accent }}>Your ERP.</span>
      </div>
      <div style={{ display: "flex", marginTop: 28, color: "#E2D4DA", fontSize: 24 }}>Configurable ERP, set up around how your company works.</div>
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", color: "#BFA9B4", fontSize: 16, letterSpacing: 5 }}><span>BUILD. OPERATE. HARMONISE.</span><span>EARLY-STAGE · DEMO AVAILABLE</span></div>
  </div>, size);
}
