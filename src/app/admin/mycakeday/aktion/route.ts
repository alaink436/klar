// POST /admin/mycakeday/aktion — die Handgriffe im MyCakeDay-Postfach.
//
// Antwort, neue Mail, Erledigt, Wieder oeffnen. Nichts davon passiert hier:
// das Formular wird gelesen und als JSON an die Betriebs-API von mycakeday.ch
// gereicht (lib/cakeday.ts), wo dieselben Funktionen laufen wie im
// Cakeday-Dashboard. Zurueck geht es auf denselben Faden mit ?stand= und der
// Meldung, wie bei /admin/collab/manual.

import { NextResponse, type NextRequest } from "next/server";
import { checkAuth } from "@/app/admin/_shared";
import { cakedayAktion } from "@/lib/cakeday";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AKTIONEN = ["antwort", "neu", "erledigt", "offen"] as const;
type Aktion = (typeof AKTIONEN)[number];

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await checkAuth(req);
  if (!auth.authed) return NextResponse.redirect(new URL("/admin/login", req.url), 303);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.redirect(new URL("/admin/mycakeday?stand=fehler&msg=Kein+Formular", req.url), 303);
  }

  const feld = (name: string, max: number) => String(form.get(name) ?? "").slice(0, max);
  const aktion = feld("aktion", 20) as Aktion;
  const faden = feld("faden", 40);
  const ordner = feld("ordner", 10);
  const suche = feld("suche", 120);

  if (!AKTIONEN.includes(aktion)) {
    return NextResponse.redirect(new URL("/admin/mycakeday?stand=fehler&msg=Unbekannte+Aktion", req.url), 303);
  }

  const ergebnis = await cakedayAktion(
    aktion === "neu"
      ? { aktion, an: feld("an", 160), betreff: feld("betreff", 200), text: feld("text", 20000) }
      : aktion === "antwort"
        ? { aktion, faden, text: feld("text", 20000) }
        : { aktion, faden },
  );

  // Nach „erledigt" nicht auf den Faden zurueck: er steht dann nicht mehr in
  // der offenen Liste, und ein Lesefenster ohne Listeneintrag sieht kaputt aus.
  const q = new URLSearchParams();
  if (faden && aktion !== "erledigt") q.set("faden", faden);
  if (ordner && ordner !== "offen") q.set("ordner", ordner);
  if (suche) q.set("suche", suche);
  q.set("stand", ergebnis.ok ? "ok" : "fehler");
  q.set("msg", ergebnis.meldung.slice(0, 400));
  return NextResponse.redirect(new URL(`/admin/mycakeday?${q}`, req.url), 303);
}
