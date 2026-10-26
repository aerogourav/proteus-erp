"use client";

import { Clock3, FileText, GitBranch, Settings2 } from "lucide-react";
import Link from "next/link";
import { useDemoConfiguration } from "@/components/demo/configuration-context";
import { useDemoBusinessRecords } from "@/components/demo/business-records-context";
import { ActivityRows, PageHeader, Panel, StatusPill } from "@/components/demo/demo-ui";
import styles from "@/components/demo/demo.module.css";

export default function WorkflowsPage() {
  const { workflows, documentTypes, documents } = useDemoConfiguration();
  const { activity } = useDemoBusinessRecords();
  const sample = documents.find((item) => item.id === "dwg-ap-1102");
  const activeFlows = workflows.filter((flow) => flow.active);
  const sampleFlow = activeFlows.find((flow) => flow.documentTypeId === sample?.typeId || documentTypes.find((type) => type.id === flow.documentTypeId)?.name === sample?.type) ?? activeFlows[0];
  const displayedStages = sampleFlow?.stages ?? [];
  const currentStageIndex = sample?.status === "Approved" ? Math.max(0, displayedStages.length - 1) : sample?.status === "In review" ? Math.min(1, Math.max(0, displayedStages.length - 1)) : 0;

  return <>
    <PageHeader eyebrow="Process visibility" title="Workflows" description="Inspect the ordered approval stages and responsible roles configured for synthetic records." meta="DEMONSTRATION ONLY" />
    <div className={styles.configToolbar}><p>Create and edit descriptive workflow definitions in Configuration.</p><Link className={styles.primaryButton} href="/demo/classic/configuration?tab=workflows#approval-workflows"><Settings2 size={14} /> Manage workflows</Link></div>
    <div className={styles.detailGrid}>
      <div className={styles.detailMain}>
        {activeFlows.map((flow) => <Panel key={flow.id} title={flow.name} description={`${documentTypes.find((type) => type.id === flow.documentTypeId)?.name ?? "All document types"} · configured stage order`}>
          {flow.stages.length ? <div className={styles.workflowGraph}>
            <div className={styles.workflowGraphHead}><span><GitBranch size={14} /> CONFIGURED SEQUENCE</span>{sampleFlow?.id === flow.id && sample && <StatusPill status={sample.status} />}</div>
            <div className={styles.workflowGraphRail}>
              {flow.stages.map((stage, index) => {
                const mapped = sampleFlow?.id === flow.id && index === currentStageIndex;
                return <article className={`${styles.workflowGraphStage} ${mapped ? styles.workflowGraphStageMapped : ""}`} key={stage.id}>
                  <span className={styles.workflowGraphMarker}>{String(index + 1).padStart(2, "0")}</span>
                  <div><small>{mapped ? "STATUS MAPPING" : <>Stage {index + 1}</>}</small><strong>{stage.name}</strong><span className={styles.workflowGraphRole}>{stage.role}</span><p>{stage.description || "No stage description configured."}</p></div>
                </article>;
              })}
            </div>
            {sampleFlow?.id === flow.id && sample && <p className={styles.workflowGraphNote}>Sample status is shown as a mapping only; no stage assignment is stored.</p>}
          </div> : <div className={styles.empty}>This configured workflow has no stages.</div>}
        </Panel>)}
        {sample && <Panel title="Synthetic workflow example" description="Sample record mapped to the configured sequence"><div className={styles.workflowRecordSummary}><span className={styles.workflowRecordIcon}><GitBranch size={15} /></span><span><Link href={`/demo/classic/documents/${sample.id}`}>{sample.number} · Rev {sample.revision}</Link><small>{sample.title}</small><small>{sample.owner} · {sample.updated}</small></span><StatusPill status={sample.status} /></div></Panel>}
        {!activeFlows.length && <Panel title="No active workflows" description="No active workflow definitions are saved in this browser."><p className={styles.detailDescription}>Add a workflow and its stage sequence in Configuration to show it here.</p></Panel>}
      </div>
      <aside className={styles.detailSide}>
        <Panel title="Workflow definitions" description="Current browser-local settings"><div className={styles.linkList}>{activeFlows.map((flow) => <div className={styles.linkRow} key={flow.id}><span>{flow.name}<small>{flow.stages.length} ordered stage{flow.stages.length === 1 ? "" : "s"}</small></span><StatusPill status="Configured" /></div>)}{!activeFlows.length && <div className={styles.empty}>No active definitions.</div>}</div></Panel>
        {sample && <Panel title="Example record"><div className={styles.workflowExampleRecord}>
          <div className={styles.workflowExampleRecordIdentity}>
            <span className={styles.workflowExampleRecordIcon}><FileText size={15} /></span>
            <div><Link href={`/demo/classic/documents/${sample.id}`}>{sample.title}</Link><div className={styles.workflowExampleRecordMeta}><span>{sample.number}</span><span>REV {sample.revision}</span></div></div>
          </div>
          <div className={styles.workflowExampleRecordFooter}><span>{sample.owner}<small>Record owner · Updated {sample.updated}</small></span><StatusPill status={sample.status} /></div>
        </div></Panel>}
        <Panel title="Recent activity" description="Synthetic record events"><ActivityRows rows={sample ? activity.filter((event) => event.recordId === sample.id) : []} /></Panel>
        <div className={styles.notice}><Clock3 size={14} /><span>Configured workflow definitions are descriptive settings only; this demo does not execute approvals or assign work.</span></div>
      </aside>
    </div>
  </>;
}
