// Klar Control · Inbox. The view itself lives in ./InboxAnsicht, shared with
// Klar Studios > Bewerbungen.

import InboxAnsicht from "./InboxAnsicht";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; f?: string; sel?: string }>;
}) {
  return <InboxAnsicht searchParams={searchParams} />;
}
