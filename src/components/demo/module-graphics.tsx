"use client";

import { ArrowRight, Boxes, FileCheck2, FileStack, GitBranch, ListChecks, ShieldCheck } from "lucide-react";
import type { OpportunityStage } from "@/lib/business-data";
import styles from "./demo.module.css";

type PipelineStageMetric = {
  stage: OpportunityStage;
  count: number;
  valueCents: number;
};

export function OpportunityPipelineGraphic({
  metrics,
  openValueCents,
  wonValueCents,
  selectedStage,
  onSelectStage,
  formatValue,
}: {
  metrics: PipelineStageMetric[];
  openValueCents: number;
  wonValueCents: number;
  selectedStage: string;
  onSelectStage: (stage: string) => void;
  formatValue: (cents: number) => string;
}) {
  const maxValue = Math.max(1, ...metrics.map((item) => item.valueCents));

  return <section className={`${styles.card} ${styles.pipelineGraphic}`} aria-label="Opportunity pipeline overview">
    <div className={styles.pipelineGraphicHead}>
      <div>
        <span className={styles.visualEyebrow}>SYNTHETIC SALES PIPELINE</span>
        <h2>Pipeline by stage</h2>
        <p>Opportunity values shown here come from the sample records.</p>
      </div>
      <div className={styles.pipelineTotals}>
        <span>Open pipeline<strong>{formatValue(openValueCents)}</strong></span>
        <span>Won value<strong>{formatValue(wonValueCents)}</strong></span>
      </div>
    </div>
    <div className={styles.pipelineStages} role="group" aria-label="Filter opportunities by stage">
      {metrics.map((item, index) => <button
        type="button"
        key={item.stage}
        className={`${styles.pipelineStage} ${selectedStage === item.stage ? styles.pipelineStageSelected : ""}`}
        onClick={() => onSelectStage(selectedStage === item.stage ? "All stages" : item.stage)}
        aria-pressed={selectedStage === item.stage}
      >
        <span className={styles.pipelineStageTop}><i>{String(index + 1).padStart(2, "0")}</i><strong>{item.stage}</strong><b>{item.count}</b></span>
        <span className={styles.pipelineTrack}><i style={{ width: `${Math.max(item.valueCents ? 6 : 0, item.valueCents / maxValue * 100)}%` }} /></span>
        <span className={styles.pipelineStageValue}>{formatValue(item.valueCents)}</span>
      </button>)}
    </div>
  </section>;
}

export type MaterialPositionRow = {
  id: string;
  code: string;
  lotNumber: string;
  available: number;
  reserved: number;
};

export function MaterialPositionGraphic({ lots }: { lots: MaterialPositionRow[] }) {
  const totals = lots.reduce((sum, lot) => ({ available: sum.available + lot.available, reserved: sum.reserved + lot.reserved }), { available: 0, reserved: 0 });
  const totalStock = totals.available + totals.reserved;
  const maxLotStock = Math.max(1, ...lots.map((lot) => lot.available + lot.reserved));

  return <section className={`${styles.card} ${styles.materialGraphic}`} aria-label="Sample stock position">
    <div className={styles.materialGraphicHead}>
      <div><span className={styles.visualEyebrow}>INVENTORY SNAPSHOT</span><h2>Sample stock position</h2><p>Available and reserved kilograms across the linked lot records.</p></div>
      <div className={styles.materialTotals}>
        <span><i className={styles.stockAvailableDot} />Available<strong>{totals.available} kg</strong></span>
        <span><i className={styles.stockReservedDot} />Reserved<strong>{totals.reserved} kg</strong></span>
        <span><Boxes size={15} />Total stock<strong>{totalStock} kg</strong></span>
      </div>
    </div>
    <div className={styles.stockChart}>
      <div className={styles.stockChartHead}><strong>Lot position</strong><span><b>{lots.length}</b> sample lots</span></div>
      <div className={styles.stockRows}>
        {lots.map((lot) => {
          const availableShare = lot.available / maxLotStock * 100;
          const reservedShare = lot.reserved / maxLotStock * 100;
          return <div className={styles.stockRow} key={lot.id}>
            <span className={styles.stockLotLabel}><strong>{lot.code}</strong><small>{lot.lotNumber}</small></span>
            <span className={styles.stockTrack} role="img" aria-label={`${lot.code}: ${lot.available} kilograms available, ${lot.reserved} kilograms reserved`}>
              <i className={styles.stockAvailable} style={{ width: `${availableShare}%` }} />
              <i className={styles.stockReserved} style={{ width: `${reservedShare}%` }} />
            </span>
            <span className={styles.stockNumbers}><strong>{lot.available}</strong><small> / {lot.reserved} kg</small></span>
          </div>;
        })}
      </div>
      <div className={styles.stockLegend}><span><i className={styles.stockAvailableDot} />Available</span><span><i className={styles.stockReservedDot} />Reserved</span><small>Bars use a shared scale across lots.</small></div>
    </div>
  </section>;
}

export type FinanceMonthMetric = { month: string; incoming: number; outgoing: number };

export function FinanceMovementGraphic({
  months,
  formatMonth,
  formatValue,
}: {
  months: FinanceMonthMetric[];
  formatMonth: (month: string) => string;
  formatValue: (cents: number) => string;
}) {
  const maxValue = Math.max(1, ...months.flatMap((item) => [item.incoming, item.outgoing]));
  const totalIn = months.reduce((sum, item) => sum + item.incoming, 0);
  const totalOut = months.reduce((sum, item) => sum + item.outgoing, 0);

  return <section className={`${styles.card} ${styles.financeGraphic}`} aria-label="Paid sample transaction chart">
    <div className={styles.financeGraphicHead}>
      <div><span className={styles.visualEyebrow}>SYNTHETIC TRANSACTION LIST</span><h2>Paid sample transactions</h2><p>Monthly amounts aggregated from entries marked paid.</p></div>
      <div className={styles.financeLegend}><span><i className={styles.financeInDot} />Incoming</span><span><i className={styles.financeOutDot} />Outgoing</span></div>
    </div>
    <div className={styles.financePlot} role="img" aria-label={`Incoming ${formatValue(totalIn)} and outgoing ${formatValue(totalOut)} across ${months.length} months`}>
      <div className={styles.financeGridLines}><i /><i /><i /><i /></div>
      {months.map((item) => <div className={styles.financeMonth} key={item.month} aria-label={`${formatMonth(item.month)}: incoming ${formatValue(item.incoming)}, outgoing ${formatValue(item.outgoing)}`}>
        <div className={styles.financeBars}>
          <span className={styles.financeIncoming} style={{ height: `${Math.max(item.incoming ? 5 : 0, item.incoming / maxValue * 100)}%` }} />
          <span className={styles.financeOutgoing} style={{ height: `${Math.max(item.outgoing ? 5 : 0, item.outgoing / maxValue * 100)}%` }} />
        </div>
        <strong>{formatMonth(item.month)}</strong>
      </div>)}
    </div>
    <div className={styles.financeGraphicFoot}><span>Incoming<strong>{formatValue(totalIn)}</strong></span><span>Outgoing<strong>{formatValue(totalOut)}</strong></span><small>Paid entries only · fictional EUR amounts</small></div>
  </section>;
}

export type ConfigurationNode = {
  label: string;
  value: string;
  detail: string;
  tab: string;
};

export function ConfigurationArchitectureGraphic({
  nodes,
  selectedTab,
  onSelect,
}: {
  nodes: ConfigurationNode[];
  selectedTab: string;
  onSelect: (tab: string) => void;
}) {
  const icons = [FileStack, ListChecks, GitBranch, ShieldCheck] as const;

  return <section className={`${styles.card} ${styles.configArchitecture}`} aria-label="Configuration flow">
    <div className={styles.configArchitectureHead}><div><span className={styles.visualEyebrow}>CONFIGURATION MODEL</span><h2>From record structure to completeness checks</h2></div><span>Browser-local demo</span></div>
    <div className={styles.configArchitectureFlow}>
      {nodes.map((node, index) => {
        const Icon = icons[index] ?? FileStack;
        return <div className={styles.configArchitectureStep} key={node.tab}>
          <button type="button" className={`${styles.configArchitectureNode} ${selectedTab === node.tab ? styles.configArchitectureNodeActive : ""}`} aria-pressed={selectedTab === node.tab} onClick={() => onSelect(node.tab)}>
            <span className={styles.configArchitectureIcon}><Icon size={16} /></span><span><strong>{node.label}</strong><small>{node.detail}</small></span><b>{node.value}</b>
          </button>
          {index < nodes.length - 1 && <ArrowRight className={styles.configArchitectureArrow} size={15} aria-hidden="true" />}
        </div>;
      })}
      <button type="button" className={`${styles.configArchitectureNode} ${styles.configArchitectureOutcome} ${selectedTab === "Configuration Preview" ? styles.configArchitectureNodeActive : ""}`} aria-pressed={selectedTab === "Configuration Preview"} onClick={() => onSelect("Configuration Preview")}>
        <span className={styles.configArchitectureIcon}><FileCheck2 size={16} /></span><span><strong>Record completeness</strong><small>Part and order checks</small></span>
      </button>
    </div>
    <p className={styles.configArchitectureNote}>Configured stages describe a review path; supported requirement rules drive the completeness checks.</p>
  </section>;
}
