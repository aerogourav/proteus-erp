"use client";

import Link from "next/link";
import { ArrowRight, FileClock, GitBranch } from "lucide-react";
import { DEMO_COMPANY } from "@/lib/demo-data";
import { evaluateOrderCompleteness } from "@/lib/configuration-rules";
import { useDemoConfiguration } from "@/components/demo/configuration-context";
import { useDemoBusinessRecords } from "@/components/demo/business-records-context";
import { DemoWalkthroughLauncher } from "@/components/demo/demo-walkthrough";
import { DemoStory } from "@/components/demo/demo-story";
import { OverviewQuickActions } from "@/components/demo/overview-quick-actions";
import { ActivityRows, DocumentRows, Metric, PageHeader, Panel, StatusPill } from "@/components/demo/demo-ui";
import styles from "@/components/demo/demo.module.css";

const documentStatuses = ["Approved", "In review", "Draft", "Outdated"] as const;

export function DemoOverview() {
  const { state, documents, documentTypes } = useDemoConfiguration();
  const { parts, productionOrders, activity } = useDemoBusinessRecords();
  const activeOrders = productionOrders.filter((order) => order.status !== "Complete");
  const reviewQueue = documents.filter((document) => document.status === "In review");
  const releasedParts = parts.filter((part) => part.status === "Released" && documents.some((document) => {
    const typeId = document.typeId ?? ({ "Engineering drawing": "engineering-drawing" } as Record<string, string>)[document.type];
    return document.partId === part.id && document.revision === part.currentRevision && document.status === "Approved" && documentTypes.some((type) => type.id === typeId && (type.id === "engineering-drawing" || /drawing/i.test(type.name)));
  }));
  const readiness = productionOrders.map((order) => ({ order, issues: evaluateOrderCompleteness(order, state, documents, parts) }));
  const needingAttention = readiness.filter(({ issues }) => issues.length > 0);
  const clearOrderCount = readiness.length - needingAttention.length;

  return <>
    <PageHeader eyebrow={`${DEMO_COMPANY.name} · Fictional demo`} title="Good morning, team" description="Orders, parts, revisions and engineering documents in one connected view." meta="SYNTHETIC WORKSPACE" />
    <DemoStory />
    <DemoWalkthroughLauncher />
    <div className={styles.metrics}>
      <Metric label="Engineering documents" value={documents.length} note="Synthetic records in this workspace" href="/demo/documents" icon="documents" />
      <Metric label="Awaiting approval" value={reviewQueue.length} note="Records currently in review" href="/demo/documents?status=In%20review" icon="review" />
      <Metric label="Controlled parts" value={releasedParts.length} note="Released with current approved drawing" href="/demo/parts" icon="parts" />
      <Metric label="Active orders" value={activeOrders.length} note="Open production order records" href="/demo/production" icon="orders" />
      <Metric label="Orders with issues" value={needingAttention.length} note="Configured record checks only" href="/demo/production" icon="orders" />
    </div>

    <div className={styles.dashboardQuickGrid}>
      <div className={styles.dashboardQuickPrimary}>
    <div className={styles.split}>
      <Panel title="Production orders needing attention" description="Configured document checks against synthetic linked records" href="/demo/production" linkLabel="All orders">
        {needingAttention.length ? <div className={styles.linkList}>{needingAttention.map(({ order, issues }) => {
          const part = parts.find((item) => item.id === order.partId);
          return <div className={styles.linkRow} key={order.id}><Link href={`/demo/production/${order.id}`}><strong>{order.number} · {part?.number} {part?.name}</strong><small>{issues.map((issue) => `${issue.label}: ${issue.reason.toLowerCase()}`).join(" · ")}</small><span className={styles.dashboardActions}>View order</span></Link><div className={styles.dashboardIssueActions}><StatusPill status="Needs attention" />{part && <Link href={`/demo/parts/${part.id}`}>Related records</Link>}</div></div>;
        })}</div> : <p className={styles.detailDescription}>No configured record issues in the current sample.</p>}
      </Panel>
      <Panel title="Document review queue" description="Synthetic records currently marked in review" href="/demo/documents?status=In%20review" linkLabel="Open documents">
        {reviewQueue.length ? <div className={styles.reviewQueue}>{reviewQueue.map((document) => <div className={styles.reviewRow} key={document.id}><FileClock size={15} /><Link href={`/demo/documents/${document.id}`}><strong>{document.number} · Rev {document.revision}</strong><small>{document.title} · {document.owner}</small></Link><StatusPill status={document.status} /></div>)}</div> : <div className={styles.empty}>No synthetic documents are currently in review.</div>}
      </Panel>
    </div>
      </div>
      <OverviewQuickActions />
    </div>

    <div className={styles.split}>
      <Panel title="Engineering record status" description="Counts from the current document records"><div className={styles.chartRows}>{documentStatuses.map((status) => {
        const count = documents.filter((document) => document.status === status).length;
        const share = documents.length ? Math.round((count / documents.length) * 100) : 0;
        return <div className={styles.chartRow} key={status}><span>{status}</span><div className={styles.chartTrack} role="img" aria-label={`${status}: ${count} of ${documents.length} records`}><i data-status={status.toLowerCase().replace(" ", "-")} style={{ width: `${share}%` }} /></div><strong>{count}</strong></div>;
      })}</div><p className={styles.chartNote}>All values summarize synthetic demonstration records, including browser-local records you create.</p></Panel>
      <Panel title="Order record checks" description="Readiness evaluation for the five sample orders"><div className={styles.readinessChart}><div className={styles.readinessRing} style={{ "--ready-share": `${readiness.length ? (clearOrderCount / readiness.length) * 100 : 0}%` } as React.CSSProperties}><span><strong>{clearOrderCount}</strong><small>of {readiness.length} clear</small></span></div><div className={styles.readinessLegend}><span><i className={styles.legendClear} />No configured issue <strong>{clearOrderCount}</strong></span><span><i className={styles.legendIssue} />Needs record review <strong>{needingAttention.length}</strong></span></div></div><p className={styles.chartNote}>A clear result means only that these configured checks found acceptable linked records. It is not a production-readiness or compliance assessment.</p></Panel>
    </div>

    <div className={styles.split}>
      <Panel title="Recently updated documents" description="Latest synthetic engineering records" href="/demo/documents" linkLabel="All documents"><DocumentRows rows={[...documents].sort((a, b) => Date.parse(b.updated) - Date.parse(a.updated)).slice(0, 5)} /></Panel>
      <Panel title="Revision activity" description="Recent revision events with linked record context" href="/demo/activity" linkLabel="Activity history"><ActivityRows rows={activity.filter((event) => /revision/i.test(event.title)).slice(0, 4)} /><p className={styles.chartNote}>A revision link identifies records for review; it does not confirm that dependent instructions or orders have been updated.</p></Panel>
    </div>
    <div className={styles.dashboardFoot}><GitBranch size={14} /><span>Rules are configurable in this browser. They do not inspect files or certify manufacturing readiness.</span><Link href="/demo/configuration">Review rules <ArrowRight size={12} /></Link></div>
  </>;
}
