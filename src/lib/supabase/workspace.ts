import "server-only";
import { supabaseConfigured } from "@/lib/supabase/config";
import { currentUser } from "@/lib/supabase/server";

export type Company = { id: string; name: string; industry: string; is_demo: boolean };

/** The signed-in user's first company and role, or why there is none. Row-level security decides everything else. */
export async function loadWorkspace() {
  if (!supabaseConfigured()) return { state: "unconfigured" as const };
  const { supabase, user } = await currentUser();
  if (!user) return { state: "signed-out" as const };
  const { data, error } = await supabase.from("memberships").select("role, company:companies(id, name, industry, is_demo)").eq("user_id", user.id).order("created_at");
  if (error) return { state: "error" as const, user };
  const first = (data ?? [])[0] as unknown as { role: string; company: Company } | undefined;
  if (!first) return { state: "no-company" as const, user };
  return { state: "ready" as const, supabase, user, company: first.company, role: first.role };
}
