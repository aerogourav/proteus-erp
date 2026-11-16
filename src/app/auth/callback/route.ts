import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath, supabaseConfigured } from "@/lib/supabase/config";
import { supabaseServer } from "@/lib/supabase/server";

/** The sign-in link from the email lands here: swap the one-time code for a session, then open the app. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  // The /expo phone app asks to come back to itself with a short-lived cookie (the redirect address itself stays the allow-listed one).
  const wanted = request.cookies.get("boh_next")?.value;
  const target = wanted === "/expo" ? "/expo" : safeNextPath(url.searchParams.get("next"));
  if (!supabaseConfigured() || !code) return NextResponse.redirect(new URL("/app/login?error=link", url.origin));
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/app/login?error=link", url.origin));
  const response = NextResponse.redirect(new URL(target, url.origin));
  if (wanted) response.cookies.delete("boh_next");
  return response;
}
