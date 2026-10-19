import { OrderBrowser } from "@/components/demo/record-browsers";
import { PageHeader, ReadinessNote } from "@/components/demo/demo-ui";

export default function ProductionPage() {
  return <><PageHeader eyebrow="Shop floor" title="Production orders" description="Review planned work alongside the engineering records linked to each order." meta="5 SYNTHETIC ORDERS" /><OrderBrowser /><div style={{ marginTop: 14 }}><ReadinessNote /></div></>;
}
