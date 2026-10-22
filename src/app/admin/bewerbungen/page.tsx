// Klar Studios · Bewerbungen. Was das Creator-Formular auf getklar.org/#creators
// schickt, landet als Anfrage in der Inbox. Damit man es unter Klar Studios
// findet (Alain, 2026-10-15), zeigt dieser Punkt dieselbe Ansicht, startet
// aber auf dem Filter "Anfragen". Dort stehen seit 2026-10-22 auch die
// Creator-Anmeldungen aus dem Dashboard und wer eingeloggt war, ohne das
// Formular abzuschicken.

import InboxAnsicht from "../inbox/InboxAnsicht";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function BewerbungenPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; f?: string; sel?: string }>;
}) {
  return <InboxAnsicht searchParams={searchParams} titel="Bewerbungen" startFilter="inquiry" />;
}
