import type { CSSProperties } from "react";

import { useId } from "react";

/** BOH ERP brand colours (Studio, Nov 2026): lavender tile with coral, amber and mint spheres. Trademark clearance pending. */
export const bohBrand = {
  ink: "#26214A",
  paper: "#F7F4FE",
  accent: "#7B66DC",
  coral: "#E2654A",
  amber: "#E09A16",
  mint: "#23935F",
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

/** The BOH mark: three connected spheres (build · operate · harmonise) on a lavender tile. */
export function BohMark({ size = 32, className, style, title }: MarkProps) {
  const id = useId().replace(/:/g, "");
  return <svg className={className} style={style} width={size} height={size} viewBox="0 0 100 100" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
    <defs>
      <linearGradient id={`${id}bg`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9A87EE" /><stop offset="1" stopColor="#5E4AC6" /></linearGradient>
      <linearGradient id={`${id}r`} x1=".2" y1=".1" x2=".8" y2=".9"><stop offset="0" stopColor="#FFC9BC" /><stop offset=".5" stopColor="#F7826B" /><stop offset="1" stopColor="#D9472D" /></linearGradient>
      <linearGradient id={`${id}p`} x1=".2" y1=".1" x2=".8" y2=".9"><stop offset="0" stopColor="#FFF0C2" /><stop offset=".55" stopColor="#F7C75A" /><stop offset="1" stopColor="#DD920F" /></linearGradient>
      <linearGradient id={`${id}g`} x1=".2" y1=".1" x2=".8" y2=".9"><stop offset="0" stopColor="#C2F2DA" /><stop offset=".5" stopColor="#5DCB98" /><stop offset="1" stopColor="#1E8A57" /></linearGradient>
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
