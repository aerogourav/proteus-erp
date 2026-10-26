import { Suspense } from "react";
import { PartDetail } from "@/components/demo/part-detail";

type PageProps = { params: Promise<{ partId: string }> };

export default function Page({ params }: PageProps) {
  return <Suspense fallback={<div role="status" style={{ padding: 18, color: "#6B7281", fontSize: 11 }}>Loading part record…</div>}><PartRouteContent params={params} /></Suspense>;
}

async function PartRouteContent({ params }: PageProps) {
  const { partId } = await params;
  return <PartDetail partId={partId} />;
}
