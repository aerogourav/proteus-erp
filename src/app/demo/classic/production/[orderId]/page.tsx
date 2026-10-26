import { Suspense } from "react";
import { ProductionOrderDetail } from "@/components/demo/production-order-detail";

type PageProps = { params: Promise<{ orderId: string }> };

export default function Page({ params }: PageProps) {
  return <Suspense fallback={<div role="status" style={{ padding: 18, color: "#6B7281", fontSize: 11 }}>Loading production order…</div>}><OrderRouteContent params={params} /></Suspense>;
}

async function OrderRouteContent({ params }: PageProps) {
  const { orderId } = await params;
  return <ProductionOrderDetail orderId={orderId} />;
}
