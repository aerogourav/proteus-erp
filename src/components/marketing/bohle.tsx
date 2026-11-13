import type { ReactNode } from "react";

type Pose = "wave" | "point" | "think" | "cheer";

/**
 * Bohle, the BOH ERP guide: the violet tile from the mark with a face, arms and legs, wearing the three
 * brand spheres. Original character drawn for this site. Decorative: the words next to it carry the meaning.
 */
export function Bohle({ pose = "wave", size = 96, className }: { pose?: Pose; size?: number; className?: string }) {
  const arm = { fill: "none", stroke: "#4A37C0", strokeWidth: 7, strokeLinecap: "round" as const };
  const right = pose === "wave" ? "M97 70 L113 46" : pose === "point" ? "M97 72 L117 84" : pose === "think" ? "M97 76 Q112 80 100 60" : "M97 66 L112 40";
  const rightHand = pose === "wave" ? [114, 43] : pose === "point" ? [119, 85] : pose === "think" ? [99, 58] : [113, 37];
  const left = pose === "cheer" ? "M23 66 L8 40" : "M23 72 L9 88";
  const leftHand = pose === "cheer" ? [7, 37] : [8, 90];
  return <svg className={`bohle${className ? ` ${className}` : ""}`} width={size} height={Math.round(size * 1.2)} viewBox="0 0 126 150" aria-hidden="true">
    <ellipse cx="62" cy="142" rx="34" ry="5" fill="#1B1930" opacity=".12" />
    <g className="bohle-leg bohle-leg-a"><path d="M48 106 L46 130" {...arm} /><ellipse cx="42" cy="133" rx="10" ry="5.5" fill="#1B1930" /></g>
    <g className="bohle-leg bohle-leg-b"><path d="M74 106 L76 130" {...arm} /><ellipse cx="80" cy="133" rx="10" ry="5.5" fill="#1B1930" /></g>
    <path d={left} {...arm} /><circle cx={leftHand[0]} cy={leftHand[1]} r="6" fill="#4A37C0" />
    <path d={right} {...arm} /><circle cx={rightHand[0]} cy={rightHand[1]} r="6" fill="#4A37C0" />
    <circle cx="44" cy="29" r="10" fill="#F0A93B" />
    <circle cx="78" cy="30" r="10" fill="#2FA871" />
    <circle cx="61" cy="21" r="12" fill="#E2654A" />
    <rect x="22" y="30" width="78" height="78" rx="24" fill="#6652D9" />
    <path d="M30 54 Q30 38 46 38 H76 Q92 38 92 54" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity=".22" />
    <circle cx="48" cy="64" r="8" fill="#FFFFFF" /><circle cx="74" cy="64" r="8" fill="#FFFFFF" />
    <circle cx={pose === "point" ? 50.5 : 49.5} cy={pose === "think" ? 62 : 65.5} r="3.6" fill="#1B1930" /><circle cx={pose === "point" ? 76.5 : 75.5} cy={pose === "think" ? 62 : 65.5} r="3.6" fill="#1B1930" />
    <circle cx="38" cy="78" r="5" fill="#F79A8A" opacity=".7" /><circle cx="84" cy="78" r="5" fill="#F79A8A" opacity=".7" />
    {pose === "think" ? <path d="M54 84 H68" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" /> : <path d={pose === "cheer" ? "M50 80 Q61 96 72 80 Z" : "M50 81 Q61 92 72 81"} fill={pose === "cheer" ? "#FFFFFF" : "none"} stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
  </svg>;
}

/** Bohle between two homepage sections: a short line that leads from one to the next, on a dashed trail. */
export function BohleSays({ children, pose = "wave", side = "left" }: { children: ReactNode; pose?: Pose; side?: "left" | "right" }) {
  return <div className={`b-guide b-guide-${side}`}>
    <div className="b-wrap b-guide-inner">
      <span className="b-guide-walker"><Bohle pose={pose} size={84} /></span>
      <p className="b-guide-bubble">{children}</p>
    </div>
  </div>;
}
