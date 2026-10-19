import { ActivityBrowser } from "@/components/demo/record-browsers";
import { PageHeader } from "@/components/demo/demo-ui";

export default function ActivityPage() {
  return <><PageHeader eyebrow="Record history" title="Activity" description="Follow synthetic events across engineering records and production orders." meta="SYNTHETIC EVENTS" /><ActivityBrowser /></>;
}
