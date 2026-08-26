"use client";

// Suchen und Sortieren fuer die Tabellen im Admin.
//
// Der Bestand: neun Tabellen (Auszahlungen, Buchungen, Vorlagen, die
// App-Seiten) rendern ihre Zeilen als HTML-Zeichenketten und haben keinen
// einzigen Griff. Wer eine Zeile sucht, scrollt. Wer nach Betrag sortieren
// will, kann es nicht.
//
// Gebaut wie `FormulareOhneSprung`: eine Stelle, die alle Tabellen bedient,
// statt neun Seiten anzufassen, die ihr Markup als Zeichenkette bauen. Der
// Baustein arbeitet auf dem fertigen DOM, also bekommt jede kuenftige Tabelle
// dieselben Griffe geschenkt.
//
// Bewusst nur ab sechs Zeilen. Ein Suchfeld ueber drei Zeilen ist kein Griff,
// sondern Laerm.
//
// Bewusst rein im Browser: sortiert und gefiltert wird, was ohnehin schon
// dasteht. Wo der Server die Menge begrenzt (Outreach holt 200 und hat seine
// eigene Suche mitsamt vier Filtern), waere ein zweiter Filter daneben eine
// Luege, weil er nur das Geladene durchsucht. Solche Tabellen sind hier ueber
// `data-klar-griffe="nein"` abwaehlbar.

import * as React from "react";
import { usePathname } from "next/navigation";

/** Ab wie vielen Datenzeilen sich Griffe lohnen. */
const AB_ZEILEN = 6;

/** Zahl aus einer Zelle lesen, oder null wenn es keine ist. */
function alsZahl(text: string): number | null {
  // Waehrung, Tausendertrenner und Prozent weg. Komma als Dezimaltrenner
  // zulassen, weil die Seiten teils deutsch formatieren.
  const roh = text
    .replace(/[^\d,.\-]/g, "")
    .replace(/'/g, "")
    .trim();
  if (!roh) return null;
  // 1.234,56 -> 1234.56   |   1,234.56 -> 1234.56
  let n: string;
  if (roh.includes(",") && roh.includes(".")) {
    n = roh.lastIndexOf(",") > roh.lastIndexOf(".") ? roh.replace(/\./g, "").replace(",", ".") : roh.replace(/,/g, "");
  } else {
    n = roh.replace(",", ".");
  }
  const z = Number(n);
  return Number.isFinite(z) ? z : null;
}

function zeilenVon(tabelle: HTMLTableElement): HTMLTableRowElement[] {
  const koerper = tabelle.tBodies[0];
  return koerper ? Array.from(koerper.rows) : [];
}

function ausstatten(tabelle: HTMLTableElement) {
  if (tabelle.dataset.klarGriffe === "nein") return;
  if (tabelle.dataset.klarAusgestattet === "ja") return;
  const kopf = tabelle.tHead?.rows[0];
  const zeilen = zeilenVon(tabelle);
  if (!kopf || zeilen.length < AB_ZEILEN) return;
  tabelle.dataset.klarAusgestattet = "ja";

  // ── Sortieren ────────────────────────────────────────────────────────────
  const spalten = Array.from(kopf.cells);
  let aktiv = -1;
  let absteigend = false;

  spalten.forEach((th, i) => {
    // Eine Spalte ohne Ueberschrift ist eine Aktionsspalte. Nichts zu sortieren.
    if (!th.textContent?.trim()) return;
    th.setAttribute("role", "button");
    th.setAttribute("tabindex", "0");
    th.dataset.klarSortierbar = "ja";
    th.title = "Klicken zum Sortieren";

    const sortiere = () => {
      absteigend = aktiv === i ? !absteigend : false;
      aktiv = i;
      const koerper = tabelle.tBodies[0];
      const aktuelle = zeilenVon(tabelle);
      aktuelle.sort((a, b) => {
        const ta = a.cells[i]?.textContent?.trim() ?? "";
        const tb = b.cells[i]?.textContent?.trim() ?? "";
        const za = alsZahl(ta);
        const zb = alsZahl(tb);
        // Zahlen numerisch, alles andere alphabetisch nach Schweizer Regeln.
        const v = za !== null && zb !== null ? za - zb : ta.localeCompare(tb, "de-CH", { numeric: true });
        return absteigend ? -v : v;
      });
      // Die Zeilen selbst verschieben, nicht kopieren: in ihnen stecken
      // Formulare, und ein Klon verliert deren Zustand und Bindungen.
      for (const z of aktuelle) koerper.appendChild(z);
      spalten.forEach((s, j) => {
        s.dataset.klarSortiert = j === i ? (absteigend ? "ab" : "auf") : "";
      });
    };

    th.addEventListener("click", sortiere);
    th.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Enter" || (e as KeyboardEvent).key === " ") {
        e.preventDefault();
        sortiere();
      }
    });
  });

  // ── Suchen ───────────────────────────────────────────────────────────────
  const leiste = document.createElement("div");
  leiste.className = "klar-tabellengriff";
  const feld = document.createElement("input");
  feld.type = "search";
  // Kein blankes Lupensymbol: das Feld sagt, was es durchsucht und wie viel.
  feld.placeholder = `In ${zeilen.length} Zeilen suchen`;
  feld.setAttribute("aria-label", "Tabelle durchsuchen");
  const zaehler = document.createElement("span");
  zaehler.className = "klar-tabellenzahl";

  feld.addEventListener("input", () => {
    const suche = feld.value.trim().toLowerCase();
    let sichtbar = 0;
    for (const z of zeilenVon(tabelle)) {
      const treffer = !suche || (z.textContent ?? "").toLowerCase().includes(suche);
      z.style.display = treffer ? "" : "none";
      if (treffer) sichtbar++;
    }
    zaehler.textContent = suche ? `${sichtbar} von ${zeilenVon(tabelle).length}` : "";
  });

  leiste.appendChild(feld);
  leiste.appendChild(zaehler);
  tabelle.parentElement?.insertBefore(leiste, tabelle);
}

export function TabellenGriffe() {
  const pfad = usePathname();

  React.useEffect(() => {
    function durchgehen() {
      for (const t of Array.from(document.querySelectorAll<HTMLTableElement>(".content table"))) ausstatten(t);
    }
    durchgehen();
    // Tabellen, die spaeter kommen: nach einem Reiterwechsel oder einem
    // router.refresh() nach einer Aktion.
    const beobachter = new MutationObserver(durchgehen);
    beobachter.observe(document.body, { childList: true, subtree: true });
    return () => beobachter.disconnect();
  }, [pfad]);

  return null;
}
