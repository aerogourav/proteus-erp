"use client";

import { Clock3 } from "lucide-react";
import { activity } from "@/lib/demo-data";
import { useDemoConfiguration } from "@/components/demo/configuration-context";
import { ActivityRows, PageHeader, Panel, StatusPill } from "@/components/demo/demo-ui";
import styles from "@/components/demo/demo.module.css";

export default function WorkflowsPage() {
  const { workflows, documentTypes, documents } = useDemoConfiguration();
  const sample = documents.find((item) => item.id === "dwg-ap-1102");
  const activeFlows = workflows.filter((flow) => flow.active);
  const sampleFlow = activeFlows.find((flow) => flow.documentTypeId === sample?.typeId || documentTypes.find((type) => type.id === flow.documentTypeId)?.name === sample?.type) ?? activeFlows[0];
  const displayedStages = sampleFlow?.stages ?? [];
  const currentStageIndex = sample?.status === "Approved" ? Math.max(0, displayedStages.length - 1) : sample?.status === "In review" ? Math.min(1, Math.max(0, displayedStages.length - 1)) : 0;

  return <>
    <PageHeader eyebrow="Process visibility" title="Workflows" description="Inspect the ordered approval stages and responsible roles configured for synthetic records." meta="DEMONSTRATION ONLY" />
    <div className={styles.detailGrid}>
      <div className={styles.detailMain}>
        {activeFlows.map((flow) => <Panel key={flow.id} title={flow.name} description={`${documentTypes.find((type) => type.id === flow.documentTypeId)?.name ?? "All document types"} · configured stage order`}>
          {flow.stages.length ? <div className={styles.steps}>{flow.stages.map((stage, index) => <div className={`${styles.step} ${sampleFlow?.id === flow.id && index < currentStageIndex ? styles.stepDone : ""} ${sampleFlow?.id === flow.id && index === currentStageIndex ? styles.stepCurrent : ""}`} key={stage.id}><span className={styles.stepCircle}>{index + 1}</span><strong>{stage.name}</strong><small>{stage.role}</small><span className={styles.stepDescription}>{stage.description}</span></div>)}</div> : <div className={styles.empty}>This configured workflow has no stages.</div>}
        </Panel>)}
        {sample && <Panel title="Synthetic workflow example" description={`${sample.number} · ${sample.status}`}><p className={styles.detailDescription}>The highlighted step is a visual mapping from this record’s status to the configured stage order. The demo does not store a real stage assignment, approvals, or notifications.</p></Panel>}
        {!activeFlows.length && <Panel title="No active workflows" description="No active workflow definitions are saved in this browser."><p className={styles.detailDescription}>Add a workflow and its stage sequence in Configuration to show it here.</p></Panel>}
      </div>
      <aside className={styles.detailSide}>
        <Panel title="Workflow definitions" description="Current browser-local settings"><div className={styles.linkList}>{activeFlows.map((flow) => <div className={styles.linkRow} key={flow.id}><span>{flow.name}<small>{flow.stages.length} ordered stage{flow.stages.length === 1 ? "" : "s"}</small></span><StatusPill status="Configured" /></div>)}{!activeFlows.length && <div className={styles.empty}>No active definitions.</div>}</div></Panel>
        {sample && <Panel title="Example record" description={sample.number}><p className={styles.detailDescription}>{sample.title} · Rev {sample.revision}</p><div className={styles.linkList}><div className={styles.linkRow}><span>{sample.owner}<small>Record owner · {sample.updated}</small></span><StatusPill status={sample.status} /></div></div></Panel>}
        <Panel title="Recent activity" description="Synthetic record events"><ActivityRows rows={sample ? activity.filter((event) => event.recordId === sample.id) : []} /></Panel>
        <div className={styles.notice}><Clock3 size={14} /><span>Configured workflow definitions are descriptive settings only; this demo does not execute approvals or assign work.</span></div>
      </aside>
    </div>
  </>;
}
