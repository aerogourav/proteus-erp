import { ImageResponse } from "next/og";

export const alt = "PROTEUS — Your business. Your workflows. Your ERP.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", flexDirection: "column", justifyContent: "space-between", padding: "64px 76px", color: "#f3f7fc", background: "linear-gradient(120deg,#0b1521 0%,#122338 65%,#172b43 100%)", fontFamily: "Arial, sans-serif" }}>
    <div style={{ position: "absolute", inset: 0, opacity: 0.14, backgroundImage: "linear-gradient(rgba(180,205,230,.25) 1px,transparent 1px),linear-gradient(90deg,rgba(180,205,230,.25) 1px,transparent 1px)", backgroundSize: "48px 48px" }} />
    <div style={{ position: "absolute", right: 88, top: 105, width: 330, height: 330, display: "flex", border: "1px solid rgba(130,175,230,.25)", borderRadius: 180 }} />
    <div style={{ position: "absolute", right: 150, top: 167, width: 206, height: 206, display: "flex", border: "1px dashed rgba(130,175,230,.32)", borderRadius: 180 }} />
    <div style={{ display: "flex", alignItems: "center", gap: 16, color: "#a8c7ff", fontSize: 20, fontWeight: 700, letterSpacing: 5 }}><span style={{ width: 24, height: 24, display: "flex", border: "2px solid #6f9fff", transform: "rotate(30deg)" }} /> PROTEUS</div>
    <div style={{ display: "flex", flexDirection: "column", maxWidth: 770 }}><div style={{ color: "#9db4cc", fontSize: 18, letterSpacing: 4, marginBottom: 20 }}>CONFIGURABLE BUSINESS SOFTWARE</div><div style={{ display: "flex", flexDirection: "column", fontSize: 66, fontWeight: 650, lineHeight: 1.08, letterSpacing: -3 }}>Your business.<br />Your workflows.<br /><span style={{ color: "#8bb0ff" }}>Your ERP.</span></div><div style={{ marginTop: 26, color: "#aab9c9", fontSize: 22 }}>A configurable ERP concept shaped around how your company works.</div></div>
    <div style={{ display: "flex", justifyContent: "space-between", color: "#7790aa", fontSize: 14, letterSpacing: 3 }}><span>EARLY-STAGE PRODUCT CONCEPT</span><span>SYNTHETIC DEMONSTRATION</span></div>
  </div>, size);
}
