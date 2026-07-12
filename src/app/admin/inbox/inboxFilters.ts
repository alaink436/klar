// Shared between the server page (validates the ?f= deep-link param) and the
// client MailClient (filter chips). Lives in its own module WITHOUT "use client":
// value-exports of a client module reach server components only as reference
// proxies (runtime TypeError), never as usable values.

export const INBOX_FILTERS = [
  "all",
  "starred",
  "inquiry",
  "collab",
  "replied",
  "converted",
  "open",
] as const;
export type InboxFilter = (typeof INBOX_FILTERS)[number];
