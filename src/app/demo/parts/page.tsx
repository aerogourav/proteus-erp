import { PartBrowser } from "@/components/demo/record-browsers";
import { PageHeader } from "@/components/demo/demo-ui";

export default function PartsPage() {
  return <><PageHeader eyebrow="Engineering catalog" title="Parts & revisions" description="Explore synthetic part records and the controlled engineering context linked to each one." meta="6 PART RECORDS" /><PartBrowser /></>;
}
