import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseConfigured, supabaseUrl } from "@/lib/supabase/config";

/**
 * Keeps the Supabase session fresh for the signed-in product. Only an optimistic step:
 * every page and server action still checks the user itself, and row-level security guards the data.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!supabaseConfigured()) return response;
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // Refreshes an expiring token and writes the new cookies onto the response.
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/app/:path*", "/auth/:path*", "/expo/:path*"],
};
