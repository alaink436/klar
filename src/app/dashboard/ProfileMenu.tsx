"use client";

// The profile at the top right of the creator dashboard (Alain 2026-10-22: "oben rechts das Profil"): a round button
// with the first letter, opening who is signed in, the payout details and sign out. Radix DropdownMenu directly, not
// the admin-themed components/ui wrapper, and without a portal: inside the page it inherits the light tokens and the
// font of `.home` (which as a class would also bring full height and the page background).

import * as Menu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { useRef } from "react";

const item =
  "flex w-full cursor-pointer select-none items-center rounded-xl px-3 py-2.5 text-[14px] font-medium outline-none transition data-[highlighted]:bg-[var(--ink)]/[0.06]";

export default function ProfileMenu({ email, handle, verified }: { email: string; handle: string | null; verified: boolean }) {
  const signOut = useRef<HTMLFormElement>(null);
  const initial = (handle || email).charAt(0).toUpperCase() || "?";
  return (
    <>
      <Menu.Root>
        <Menu.Trigger
          aria-label="Your profile"
          className="flex size-10 items-center justify-center rounded-full bg-[var(--ink)] text-[15px] font-semibold text-[var(--paper)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] outline-none transition hover:opacity-85 focus-visible:ring-2 focus-visible:ring-black/20"
        >
          {initial}
        </Menu.Trigger>
        <Menu.Content
            align="end"
            sideOffset={12}
            className="z-50 w-[260px] rounded-2xl border border-white/80 bg-white/95 p-1.5 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.35)] backdrop-blur-xl"
          >
            <div className="px-3 pb-2.5 pt-2">
              <p className="truncate text-[15px] font-medium">{handle ? `@${handle}` : "TikTok not connected"}</p>
              <p className="truncate text-[13px] text-[var(--ink-3)]">{email}</p>
              {handle && !verified && <p className="mt-1 text-[12.5px] text-[var(--ink-3)]">Waiting for the code in your bio</p>}
            </div>
            <Menu.Separator className="my-1 h-px bg-[var(--hair)]" />
            <Menu.Item asChild>
              <Link href="/dashboard?tab=payouts" className={item}>Payout details</Link>
            </Menu.Item>
            <Menu.Item className={item} onSelect={() => signOut.current?.requestSubmit()}>
              Sign out
            </Menu.Item>
        </Menu.Content>
      </Menu.Root>
      <form ref={signOut} action="/dashboard/logout" method="post" hidden />
    </>
  );
}
