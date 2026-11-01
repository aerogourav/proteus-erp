import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath, supabaseConfigured } from "@/lib/supabase/config";
import { supabaseServer } from "@/lib/supabase/server";

/** The sign-in link from the email lands here: swap the one-time code for a session, then open the app. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const target = safeNextPath(url.searchParams.get("next"));
  if (!supabaseConfigured() || !code) return NextResponse.redirect(new URL("/app/login?error=link", url.origin));
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/app/login?error=link", url.origin));
  return NextResponse.redirect(new URL(target, url.origin));
}
