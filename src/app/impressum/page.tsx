import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { legal, legalComplete } from "@/lib/legal";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Impressum", "Legal information about the provider of the BOH ERP website.", "/impressum", { indexable: false });

const missing = "To be completed";

export default function ImpressumPage() {
  const rows: [string, string][] = [
    ["Provider", [legal.companyName, legal.legalForm].filter(Boolean).join(" ") || missing],
    ["Represented by", legal.representative || missing],
    ["Address", [legal.street, legal.postalCity, legal.country].filter(Boolean).join(", ") || missing],
    ["Email", legal.email || missing],
    ...(legal.phone ? [["Phone", legal.phone] as [string, string]] : []),
    ...(legal.register ? [["Register entry", legal.register] as [string, string]] : []),
    ...(legal.vatId ? [["VAT ID", legal.vatId] as [string, string]] : []),
  ];

  return <div className="b-site"><SiteHeader /><main id="top" className="b-page"><div className="b-wrap b-prose">
    <span className="b-kicker">Legal notice</span>
    <h1>Impressum</h1>
    {!legalComplete && <p className="b-notice">The provider details on this page are still being completed.</p>}
    <dl className="b-legal-table">{rows.map(([label, value]) => <div key={label} style={{ display: "contents" }}><dt>{label}</dt><dd data-no-translate>{value}</dd></div>)}</dl>
    <h2>Responsible for content</h2>
    <p data-no-translate>{legal.representative || missing}</p>
    <h2>Liability for content</h2>
    <p>We create the content of this website with care. The interactive demo uses a fictional company and synthetic records and does not describe real customers, projects or results.</p>
  </div></main><SiteFooter /></div>;
}
