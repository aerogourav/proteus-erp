import type { CSSProperties } from "react";

import { useId } from "react";

/** BOH ERP brand colours, taken from the logo: deep plum, coral, peach and green. Trademark clearance pending. */
export const bohBrand = {
  ink: "#1F0E18",
  paper: "#FBF4EE",
  accent: "#F2566F",
  peach: "#FFB27E",
  green: "#2E9E62",
} as const;

type Tone = "light" | "dark";

type MarkProps = {
  size?: number;
  /** Kept for compatibility; the mark is the same full-colour app icon on any background. */
  tone?: Tone;
  smile?: boolean;
  className?: string;
  style?: CSSProperties;
  title?: string;
};

/** The BOH mark: three connected spheres (build · operate · harmonise) on a plum tile. */
export function BohMark({ size = 32, className, style, title }: MarkProps) {
  const id = useId().replace(/:/g, "");
  return <svg className={className} style={style} width={size} height={size} viewBox="0 0 100 100" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
    <defs>
      <linearGradient id={`${id}bg`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2E1521" /><stop offset="1" stopColor="#1E0D16" /></linearGradient>
      <linearGradient id={`${id}r`} x1=".2" y1=".1" x2=".8" y2=".9"><stop offset="0" stopColor="#FF97A0" /><stop offset=".5" stopColor="#F45470" /><stop offset="1" stopColor="#C8183E" /></linearGradient>
      <linearGradient id={`${id}p`} x1=".2" y1=".1" x2=".8" y2=".9"><stop offset="0" stopColor="#FEE6C6" /><stop offset=".55" stopColor="#FFB27E" /><stop offset="1" stopColor="#FF7F55" /></linearGradient>
      <linearGradient id={`${id}g`} x1=".2" y1=".1" x2=".8" y2=".9"><stop offset="0" stopColor="#8EE59D" /><stop offset=".5" stopColor="#3DB873" /><stop offset="1" stopColor="#0B6038" /></linearGradient>
    </defs>
    <rect width="100" height="100" rx="24" fill={`url(#${id}bg)`} />
    <path d="M38 25C34 34 28 42 18 49C28 45 40 44 52 47Z" fill={`url(#${id}r)`} />
    <circle cx="53.5" cy="31" r="16" fill={`url(#${id}r)`} />
    <path d="M30 78.5C40 76.5 50 76.5 62.5 83.5C54 77 48 70 43.5 56Z" fill={`url(#${id}p)`} />
    <circle cx="28.5" cy="62.5" r="16" fill={`url(#${id}p)`} />
    <path d="M83.5 56C78 48 74 40 71 29.5C70 39 66 47 58 56Z" fill={`url(#${id}g)`} />
    <circle cx="70.5" cy="66.5" r="16.5" fill={`url(#${id}g)`} />
  </svg>;
}

/** Character + "BOH ERP" wordmark lockup. */
export function BohLogo({ tone = "light", size = 30, className }: { tone?: Tone; size?: number; className?: string }) {
  return <span className={`boh-logo${tone === "dark" ? " boh-logo-dark" : ""}${className ? ` ${className}` : ""}`}>
    <BohMark size={size} tone={tone} />
    <span className="boh-logo-word" data-no-translate><b>BOH</b> ERP</span>
  </span>;
}
