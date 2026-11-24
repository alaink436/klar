// Open consult times from cal.getklar.org, for /consult/book (Alain, 2026-11-24: "ich möchte definieren wo es
// automatisch annimmt, und wann ich selber bestätigen muss"). Two hidden cal.com events with the same title,
// each on its own schedule that Alain edits in cal.com (Availability):
//   consult          "Consult: sofort angenommen"  -> booked right away
//   consult-anfrage  "Consult: mit Bestätigung"    -> Alain confirms by email
// The visitor sees one list; each time links to the booking form of the event it belongs to. Both events
// forward to /consult/pay and the CHF 99 RevenueCat checkout after booking.

const CAL = "https://cal.getklar.org";
const USER = "klar";
export const CONSULT_EVENTS = ["consult", "consult-anfrage"] as const;
export type ConsultEvent = (typeof CONSULT_EVENTS)[number];
const TZ = "Europe/Zurich";

export interface ConsultSlot {
  time: string; // ISO, UTC
  event: ConsultEvent;
  href: string;
}

export interface ConsultDay {
  date: string; // YYYY-MM-DD in Zurich
  slots: ConsultSlot[];
}

export function bookingHref(event: ConsultEvent, time: string): string {
  const date = zurichDate(time);
  const q = new URLSearchParams({ month: date.slice(0, 7), date, slot: time });
  return `${CAL}/${USER}/${event}?${q}`;
}

export function zurichDate(time: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(time),
  );
}

/** Merges the slots of both events into days, earliest first. A time both events offer goes to the automatic one. */
export function mergeSlots(byEvent: Partial<Record<ConsultEvent, string[]>>): ConsultDay[] {
  const seen = new Map<string, ConsultSlot>();
  for (const event of CONSULT_EVENTS) {
    for (const time of byEvent[event] ?? []) {
      if (!seen.has(time)) seen.set(time, { time, event, href: bookingHref(event, time) });
    }
  }
  const days = new Map<string, ConsultSlot[]>();
  for (const slot of [...seen.values()].sort((a, b) => a.time.localeCompare(b.time))) {
    const d = zurichDate(slot.time);
    days.set(d, [...(days.get(d) ?? []), slot]);
  }
  return [...days].map(([date, slots]) => ({ date, slots }));
}

async function fetchEvent(event: ConsultEvent, from: Date, to: Date): Promise<string[]> {
  const input = {
    json: {
      isTeamEvent: false,
      usernameList: [USER],
      eventTypeSlug: event,
      startTime: from.toISOString(),
      endTime: to.toISOString(),
      timeZone: TZ,
      duration: "60",
    },
  };
  const res = await fetch(`${CAL}/api/trpc/slots/getSchedule?input=${encodeURIComponent(JSON.stringify(input))}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`cal.com ${event}: ${res.status}`);
  const body = (await res.json()) as { result?: { data?: { json?: { slots?: Record<string, { time: string }[]> } } } };
  return Object.values(body.result?.data?.json?.slots ?? {}).flatMap((day) => day.map((s) => s.time));
}

/** Open times of the next `days` days. Null when cal.com does not answer, so the page can fall back to cal.com. */
export async function fetchConsultDays(days = 14): Promise<ConsultDay[] | null> {
  const from = new Date();
  const to = new Date(from.getTime() + days * 86_400_000);
  try {
    const [auto, ask] = await Promise.all(CONSULT_EVENTS.map((e) => fetchEvent(e, from, to)));
    return mergeSlots({ consult: auto, "consult-anfrage": ask });
  } catch (e) {
    console.error("consult slots", e);
    return null;
  }
}
