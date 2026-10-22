"use client";

// The header's creator links: signed out "Sign in" and the "For creators" pill,
// signed in only a "Dashboard" pill (the pitch is no use to someone already in,
// and both would not fit next to "Klar Studios" on a phone). Signed in means the
// hub's session cookie is there, which @supabase/ssr keeps readable for the
// browser; checked here so the pages sharing the header need no session lookup.

import Link from "next/link";
import { useSyncExternalStore } from "react";

const SESSION = /(?:^|;\s*)sb-[a-z0-9]+-auth-token/;
const noop = () => () => {};
const pill =
  "inline-flex h-9 items-center rounded-full bg-[var(--ink)] px-4 text-[var(--paper)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:opacity-85";

export default function CreatorLinks() {
  const signedIn = useSyncExternalStore(noop, () => SESSION.test(document.cookie), () => false);
  if (signedIn) return <Link href="/dashboard" className={pill}>Dashboard</Link>;
  return (
    <>
      <Link href="/dashboard/login" className="transition hover:text-[var(--ink)]">Sign in</Link>
      <Link href="/#creators" className={pill}>For creators</Link>
    </>
  );
}
