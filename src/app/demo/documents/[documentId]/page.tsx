import { Suspense } from "react";
import { DocumentDetail } from "@/components/demo/document-detail";

type PageProps = { params: Promise<{ documentId: string }> };

export default function Page({ params }: PageProps) {
  return <Suspense fallback={<div role="status" style={{ padding: 18, color: "#6B7281", fontSize: 11 }}>Loading document record…</div>}><DocumentRouteContent params={params} /></Suspense>;
}

async function DocumentRouteContent({ params }: PageProps) {
  const { documentId } = await params;
  return <DocumentDetail documentId={documentId} />;
}
