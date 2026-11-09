import type { CSSProperties } from "react";

/** BOH ERP brand colours (enterprise light, Nov 2026): deep navy tile with blue, amber and teal spheres. Trademark clearance pending. */
export const bohBrand = {
  ink: "#1B2333",
  paper: "#F5F6F8",
  accent: "#2563EB",
  blue: "#6B97F2",
  amber: "#D6A45C",
  teal: "#4FAE9F",
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

/** The BOH mark: three connected spheres (build · operate · harmonise) on a navy tile. Flat colours, no gradients. */
export function BohMark({ size = 32, className, style, title }: MarkProps) {
  return <svg className={className} style={style} width={size} height={size} viewBox="0 0 100 100" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
    <rect width="100" height="100" rx="22" fill={bohBrand.ink} />
    <path d="M38 25C34 34 28 42 18 49C28 45 40 44 52 47Z" fill={bohBrand.blue} />
    <circle cx="53.5" cy="31" r="16" fill={bohBrand.blue} />
    <path d="M30 78.5C40 76.5 50 76.5 62.5 83.5C54 77 48 70 43.5 56Z" fill={bohBrand.amber} />
    <circle cx="28.5" cy="62.5" r="16" fill={bohBrand.amber} />
    <path d="M83.5 56C78 48 74 40 71 29.5C70 39 66 47 58 56Z" fill={bohBrand.teal} />
    <circle cx="70.5" cy="66.5" r="16.5" fill={bohBrand.teal} />
  </svg>;
}

/** Character + "BOH ERP" wordmark lockup. */
export function BohLogo({ tone = "light", size = 30, className }: { tone?: Tone; size?: number; className?: string }) {
  return <span className={`boh-logo${tone === "dark" ? " boh-logo-dark" : ""}${className ? ` ${className}` : ""}`}>
    <BohMark size={size} tone={tone} />
    <span className="boh-logo-word" data-no-translate><b>BOH</b> ERP</span>
  </span>;
}
