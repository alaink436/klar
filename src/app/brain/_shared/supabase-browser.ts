"use client";

// Browser-side Supabase client for the AI-Brain login form (singleton).

import { createBrowserClient } from "@supabase/ssr";

const URL =
  process.env.NEXT_PUBLIC_KLAR_INBOX_SUPABASE_URL ??
  "https://exiuwektrqxvycclqfdd.supabase.co";
const ANON = process.env.NEXT_PUBLIC_KLAR_INBOX_ANON_KEY ?? "";

let client: ReturnType<typeof createBrowserClient> | null = null;

export function getBrowserSupabase() {
  if (!client) {
    client = createBrowserClient(URL, ANON);
  }
  return client;
}
