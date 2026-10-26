import type { CSSProperties } from "react";

/** BOH ERP brand colours. Draft identity — final logo not yet approved. */
export const bohBrand = {
  ink: "#10141B",
  paper: "#F4F2EC",
  accent: "#3DDC97",
} as const;

type Tone = "light" | "dark";

type MarkProps = {
  size?: number;
  /** "light" = dark character for light backgrounds; "dark" = light character for dark backgrounds. */
  tone?: Tone;
  smile?: boolean;
  className?: string;
  style?: CSSProperties;
  title?: string;
};

/** The BOH character: a rounded module with a visor and a snap-on tab. */
export function BohMark({ size = 32, tone = "light", smile = false, className, style, title }: MarkProps) {
  const body = tone === "light" ? bohBrand.ink : bohBrand.paper;
  const visor = tone === "light" ? bohBrand.paper : bohBrand.ink;
  const eyes = tone === "light" ? bohBrand.ink : bohBrand.accent;
  return <svg className={className} style={style} width={size} height={size} viewBox="0 0 100 100" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
    <rect x="40" y="6" width="20" height="18" rx="5" fill={bohBrand.accent} />
    <rect x="14" y="20" width="72" height="72" rx="22" fill={body} />
    <rect x="24" y="40" width="52" height="24" rx="12" fill={visor} />
    <circle cx="41" cy="52" r="5" fill={eyes} />
    <circle cx="59" cy="52" r="5" fill={eyes} />
    {smile && <path d="M43 75 Q50 81 57 75" fill="none" stroke={visor} strokeWidth="4" strokeLinecap="round" />}
  </svg>;
}

/** Character + "BOH ERP" wordmark lockup. */
export function BohLogo({ tone = "light", size = 30, className }: { tone?: Tone; size?: number; className?: string }) {
  return <span className={`boh-logo${tone === "dark" ? " boh-logo-dark" : ""}${className ? ` ${className}` : ""}`}>
    <BohMark size={size} tone={tone} />
    <span className="boh-logo-word" data-no-translate><b>BOH</b> ERP</span>
  </span>;
}
