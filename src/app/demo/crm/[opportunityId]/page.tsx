"use client";
import { Suspense, use } from "react";
import { OpportunityDetail } from "@/components/demo/business-modules";
function Detail({ params }: { params: Promise<{ opportunityId: string }> }) { const { opportunityId } = use(params); return <OpportunityDetail id={opportunityId} />; }
export default function OpportunityPage({ params }: { params: Promise<{ opportunityId: string }> }) { return <Suspense fallback={<div role="status">Loading opportunity…</div>}><Detail params={params} /></Suspense>; }
