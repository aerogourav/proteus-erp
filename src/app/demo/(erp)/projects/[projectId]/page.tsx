import { Suspense } from "react";
import { ProjectWorkspace } from "@/components/erp/project";

type PageProps = { params: Promise<{ projectId: string }> };

export default function ProjectPage({ params }: PageProps) {
  return <Suspense fallback={<p role="status">Loading project…</p>}><ProjectRoute params={params} /></Suspense>;
}

async function ProjectRoute({ params }: PageProps) {
  const { projectId } = await params;
  return <ProjectWorkspace projectId={decodeURIComponent(projectId)} />;
}
