"use client";

import { useSyncExternalStore } from "react";
import type { ConsultSlot } from "@/lib/consultSlots";

// The open times in the visitor's own time zone (Alain, 2026-11-24: US visitors only saw Swiss times and had
// to convert). The server renders Swiss time; after load the browser regroups the same slots by its own zone.

const chip =
  "inline-flex h-11 items-center rounded-full border border-white/70 bg-white/60 px-5 text-[15px] font-medium tabular-nums tracking-[-0.01em] shadow-[0_8px_24px_-16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.9)] transition hover:bg-[var(--ink)] hover:text-[var(--paper)]";

const SWISS = "Europe/Zurich";
const noSubscribe = () => () => {};

export default function SlotList({ slots }: { slots: ConsultSlot[] }) {
  const tz = useSyncExternalStore(
    noSubscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || SWISS,
    () => SWISS,
  );

  const day = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: tz });
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz });
  const days = new Map<string, ConsultSlot[]>();
  for (const s of slots) {
    const d = day.format(new Date(s.time));
    days.set(d, [...(days.get(d) ?? []), s]);
  }

  return (
    <>
      <p className="mb-8 text-[14px] text-[var(--ink-3)]">
        Times in your time zone ({tz.replace(/_/g, " ")})
      </p>
      <ol className="space-y-8">
        {[...days].map(([d, list]) => (
          <li key={d}>
            <p className="text-[15px] font-medium tracking-[-0.01em] text-[var(--ink-3)]">{d}</p>
            <div className="mt-3 flex flex-wrap gap-2.5">
              {list.map((s) => (
                <a key={s.time} href={s.href} className={chip}>
                  {time.format(new Date(s.time))}
                </a>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
