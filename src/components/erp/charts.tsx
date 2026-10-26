"use client";

import { useState, type ReactNode } from "react";

/** Categorical order validated for colour-vision deficiency on the cream surface; always paired with direct labels. */
export const CHART_COLORS = ["#E0485F", "#2F6FB0", "#2E9E62", "#C46A1E"] as const;
export const CHART_NEUTRAL = "#B9A9B1";

export type Datum = { label: string; value: number; display: string; color?: string; note?: string };

/** Horizontal bars: magnitude by category, value labelled at the bar end. */
export function BarList({ data, label, empty = "No data yet." }: { data: Datum[]; label: string; empty?: string }) {
  const max = Math.max(0, ...data.map((item) => item.value));
  if (!data.length || max <= 0) return <p className="erp-faint">{empty}</p>;
  return <ul className="erp-barlist" aria-label={label}>
    {data.map((item) => <li key={item.label} data-tip={`${item.label}: ${item.display}${item.note ? ` · ${item.note}` : ""}`}>
      <span className="erp-barlist-label">{item.label}</span>
      <span className="erp-barlist-track"><span style={{ width: `${Math.max(2, (item.value / max) * 100)}%`, background: item.color ?? CHART_COLORS[0] }} /></span>
      <span className="erp-barlist-value">{item.display}</span>
    </li>)}
  </ul>;
}

/** One 100% bar split into parts, with a legend that carries each value. */
export function StackedBar({ data, label, empty = "No data yet." }: { data: Datum[]; label: string; empty?: string }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) return <p className="erp-faint">{empty}</p>;
  const shown = data.filter((item) => item.value > 0);
  return <div className="erp-stacked" role="img" aria-label={`${label}: ${shown.map((item) => `${item.label} ${item.display}`).join(", ")}`}>
    <div className="erp-stacked-bar">{shown.map((item, index) => <span key={item.label} data-tip={`${item.label}: ${item.display}`} style={{ flexGrow: item.value, background: item.color ?? CHART_COLORS[index % CHART_COLORS.length] }} />)}</div>
    <ul className="erp-legend">{shown.map((item, index) => <li key={item.label}><i style={{ background: item.color ?? CHART_COLORS[index % CHART_COLORS.length] }} />{item.label}<b>{item.display}</b></li>)}</ul>
  </div>;
}

/** Grouped columns for two to four series sharing one unit (one axis only). */
export function Columns({ categories, series, format, label }: { categories: string[]; series: { name: string; values: number[]; color: string }[]; format: (value: number) => string; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(0, ...series.flatMap((item) => item.values));
  if (!categories.length || max <= 0) return <p className="erp-faint">No data yet.</p>;
  const width = 100 / categories.length;
  return <div className="erp-columns">
    <ul className="erp-legend">{series.map((item) => <li key={item.name}><i style={{ background: item.color }} />{item.name}</li>)}</ul>
    <div className="erp-columns-plot" role="img" aria-label={label} onMouseLeave={() => setHover(null)}>
      {[0.5, 1].map((tick) => <span key={tick} className="erp-columns-grid" style={{ bottom: `${tick * 100}%` }}><em>{format(max * tick)}</em></span>)}
      {categories.map((category, index) => <div key={category} className={`erp-columns-group${hover === index ? " is-hover" : ""}`} style={{ width: `${width}%` }} onMouseEnter={() => setHover(index)} onFocus={() => setHover(index)} tabIndex={0} aria-label={`${category}: ${series.map((item) => `${item.name} ${format(item.values[index] ?? 0)}`).join(", ")}`}>
        <div className="erp-columns-bars">{series.map((item) => <span key={item.name} style={{ height: `${((item.values[index] ?? 0) / max) * 100}%`, background: item.color }} />)}</div>
        {hover === index && <div className="erp-tooltip" role="status"><b>{category}</b>{series.map((item) => <span key={item.name}><i style={{ background: item.color }} />{item.name}<em>{format(item.values[index] ?? 0)}</em></span>)}</div>}
      </div>)}
    </div>
    <div className="erp-columns-axis">{categories.map((category) => <span key={category} style={{ width: `${width}%` }}>{category}</span>)}</div>
  </div>;
}

/** A single headline figure. */
export function Stat({ label, value, note, tone }: { label: string; value: ReactNode; note?: ReactNode; tone?: "warn" | "bad" }) {
  return <article className={`erp-card erp-kpi${tone ? ` is-${tone}` : ""}`}><small>{label}</small><strong>{value}</strong>{note && <span>{note}</span>}</article>;
}
