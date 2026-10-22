// Klar Studios · Bewerbungen. Was das Creator-Formular auf getklar.org/#creators
// schickt, landet als Anfrage in der Inbox. Damit man es unter Klar Studios
// findet (Alain, 2026-10-15), zeigt dieser Punkt dieselbe Ansicht, startet
// aber auf dem Filter "Anfragen". Darüber die Creator-Anmeldungen aus dem
// Dashboard (2026-10-22).

import InboxAnsicht from "../inbox/InboxAnsicht";
import Anmeldungen from "./Anmeldungen";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function BewerbungenPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; f?: string; sel?: string }>;
}) {
  return <InboxAnsicht searchParams={searchParams} titel="Bewerbungen" startFilter="inquiry" oben={<Anmeldungen />} />;
}
