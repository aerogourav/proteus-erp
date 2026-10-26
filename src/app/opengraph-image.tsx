import { ImageResponse } from "next/og";

export const alt = "BOH ERP — Your business. Your workflows. Your ERP.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ink = "#10141B";
const paper = "#F4F2EC";
const accent = "#3DDC97";

export default function OpenGraphImage() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 76px", color: paper, background: ink, fontFamily: "Arial, sans-serif" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <svg width="64" height="64" viewBox="0 0 100 100">
        <rect x="40" y="6" width="20" height="18" rx="5" fill={accent} />
        <rect x="14" y="20" width="72" height="72" rx="22" fill={paper} />
        <rect x="24" y="40" width="52" height="24" rx="12" fill={ink} />
        <circle cx="41" cy="52" r="5" fill={accent} />
        <circle cx="59" cy="52" r="5" fill={accent} />
      </svg>
      <div style={{ display: "flex", fontSize: 34, fontWeight: 700, letterSpacing: 1 }}>BOH<span style={{ fontWeight: 400, marginLeft: 10 }}>ERP</span></div>
    </div>
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", flexDirection: "column", fontSize: 72, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
        <span>Your business.</span><span>Your workflows.</span><span style={{ color: accent }}>Your ERP.</span>
      </div>
      <div style={{ display: "flex", marginTop: 28, color: "#C9CED8", fontSize: 24 }}>Configurable ERP, set up around how your company works.</div>
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", color: "#A7AFBD", fontSize: 16, letterSpacing: 5 }}><span>BUILD. OPERATE. HARMONISE.</span><span>EARLY-STAGE · DEMO AVAILABLE</span></div>
  </div>, size);
}
