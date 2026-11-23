"use client";

// The header's pill: signed out "Consult" (since 2026-11-23 getklar.org sells
// consults and collaborations instead of recruiting creators, Alain: "das ganze mit
// dem creator slideshows kannst du wieder rausnehmen"), signed in still "Dashboard",
// so creators already in keep their way to it. Signed in means the hub's session
// cookie is there, which @supabase/ssr keeps readable for the browser; checked here
// so the pages sharing the header need no session lookup.

import Link from "next/link";
import { useSyncExternalStore } from "react";

const SESSION = /(?:^|;\s*)sb-[a-z0-9]+-auth-token/;
const noop = () => () => {};
const pill =
  "inline-flex h-9 items-center rounded-full bg-[var(--ink)] px-4 text-[var(--paper)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:opacity-85";

export default function CreatorLinks() {
  const signedIn = useSyncExternalStore(noop, () => SESSION.test(document.cookie), () => false);
  if (signedIn) return <Link href="/dashboard" className={pill}>Dashboard</Link>;
  return <Link href="/consult" className={pill}>Consult</Link>;
}
