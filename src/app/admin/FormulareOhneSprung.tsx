"use client";

// Aktionen ohne Seitenwechsel.
//
// Der Bestand: 30 Formulare im Admin schicken an einen Route-Handler, der mit
// 303 auf dieselbe Seite zurueckleitet und die Rueckmeldung als `?msg=` in die
// Adresszeile haengt. Jeder Klick auf "Sperren", "Freigeben" oder "Speichern"
// war damit ein kompletter Seitenaufbau: die Ansicht springt nach oben, der
// Scroll-Stand ist weg, alle Daten werden neu geholt, und ob es geklappt hat,
// erfaehrt man erst danach.
//
// Statt dreissig Routen einzeln umzubauen faengt diese Komponente das
// Abschicken zentral ab, schickt dasselbe Formular per fetch und zeigt das
// Ergebnis als Meldung. Danach nur `router.refresh()`: die Serverdaten kommen
// frisch, aber die Seite bleibt stehen, wo sie steht. Die Routen selbst bleiben
// unberuehrt und funktionieren ohne JavaScript weiter genau wie vorher.
//
// Dass ein zentraler Abfang hier das Mittel der Wahl ist, ist keine Erfindung:
// das Bestaetigungs-Modal in `_shared.ts` arbeitet seit je genauso, mit einem
// MutationObserver ueber dem ganzen Dokument.
//
// Zusammenspiel mit eben diesem Modal: es haengt am Formular selbst und ruft
// beim ersten Absenden `preventDefault()`, bis bestaetigt wurde. Wir haengen am
// Dokument, sehen das Ereignis also spaeter, und lassen alles liegen, was schon
// abgefangen wurde. Erst der bestaetigte zweite Durchlauf gehoert uns.
//
// Opt-out mit `data-klar-sprung="ja"` am Formular, fuer alles, was wirklich
// navigieren soll.

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/** Formulare, die eine echte Navigation brauchen und nie abgefangen werden. */
const NIE_ABFANGEN = ["/admin/login/submit", "/admin/logout"];

export function FormulareOhneSprung() {
  const router = useRouter();

  React.useEffect(() => {
    async function beiSubmit(ev: SubmitEvent) {
      const form = ev.target as HTMLFormElement | null;
      if (!form || !(form instanceof HTMLFormElement)) return;

      // Das Bestaetigungs-Modal hat abgebrochen und fragt gerade nach. Sein
      // zweiter, bestaetigter Anlauf landet gleich noch einmal hier.
      if (ev.defaultPrevented) return;

      const ziel = form.getAttribute("action") ?? "";
      if (!ziel.startsWith("/admin/")) return;
      if (NIE_ABFANGEN.some((p) => ziel.startsWith(p))) return;
      if (form.dataset.klarSprung === "ja") return;
      if ((form.getAttribute("method") ?? "get").toLowerCase() !== "post") return;
      // Ein Datei-Upload gehoert nicht durch diesen Weg.
      if (form.enctype === "multipart/form-data") return;

      ev.preventDefault();
      if (form.dataset.klarLaeuft === "ja") return; // Doppelklick abfangen
      form.dataset.klarLaeuft = "ja";

      const daten = new FormData(form);
      // Ein Absende-Knopf mit name/value gehoert zur Fracht. Der Browser legt
      // ihn von selbst dazu, `new FormData(form)` nicht.
      const ausloeser = (ev as SubmitEvent).submitter as HTMLButtonElement | null;
      if (ausloeser?.name) daten.append(ausloeser.name, ausloeser.value ?? "");

      try {
        const antwort = await fetch(ziel, {
          method: "POST",
          body: daten,
          // Der Weiterleitung folgen und danach die END-Adresse lesen: dort
          // steht die Rueckmeldung, die die Route als `?msg=` mitgibt. Mit
          // "manual" kaeme eine undurchsichtige Antwort ohne Kopfzeilen zurueck.
          redirect: "follow",
        });

        const ende = new URL(antwort.url, location.href);
        const meldung = ende.searchParams.get("msg");
        const fehler = ende.searchParams.get("err");

        if (!antwort.ok) {
          toast.error(fehler || `Das ging nicht (${antwort.status}).`);
          return;
        }
        if (fehler) {
          toast.error(fehler);
        } else if (meldung) {
          toast.success(meldung);
        } else {
          toast.success("Erledigt.");
        }

        if (ende.pathname !== location.pathname) {
          // Die Aktion fuehrt woanders hin, etwa vom Freigeben zurueck in die
          // Inbox. Dann ist der Wechsel gewollt, nur ohne harten Neuaufbau.
          router.push(ende.pathname + ende.search);
        } else {
          // Gleiche Seite: Daten frisch holen, Ansicht stehen lassen.
          router.refresh();
        }
        // Ein Formular, das etwas anlegt, soll danach leer sein. Eines, das
        // etwas schaltet, nicht: `reset` wuerde die Auswahl zuruecksetzen.
        if (form.dataset.klarLeeren === "ja") form.reset();
      } catch {
        toast.error("Keine Verbindung. Nichts wurde gespeichert.");
      } finally {
        delete form.dataset.klarLaeuft;
      }
    }

    document.addEventListener("submit", beiSubmit);
    return () => document.removeEventListener("submit", beiSubmit);
  }, [router]);

  return null;
}
