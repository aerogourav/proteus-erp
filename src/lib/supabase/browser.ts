"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config";

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Supabase client in the browser, sharing the session cookie with the server. */
export function supabaseBrowser() {
  client ??= createBrowserClient(supabaseUrl, supabaseAnonKey);
  return client;
}
