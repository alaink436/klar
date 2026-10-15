// Shared between the server page (validates the ?f= deep-link param) and the
// client MailClient (filter chips). Lives in its own module WITHOUT "use client":
// value-exports of a client module reach server components only as reference
// proxies (runtime TypeError), never as usable values.

export const INBOX_FILTERS = [
  "all",
  "starred",
  "inquiry",
  "collab",
] as const;
export type InboxFilter = (typeof INBOX_FILTERS)[number];

// Eigene Testanfragen, die nie in der Inbox auftauchen. Die Uebersicht zaehlt
// mit derselben Regel, sonst meldet sie Anfragen, die die Inbox nicht zeigt.
export const isTestInquiry = (r: { email?: string | null; handle?: string | null }): boolean => {
  const email = (r.email ?? "").toLowerCase();
  const handle = (r.handle ?? "").toLowerCase();
  if (email === "alainkessler04@gmail.com") return true;
  if (handle.includes("selftest") || handle === "klar_test" || handle === "@bombo") return true;
  return false;
};
