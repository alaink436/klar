"use client";

// "Was liegt an". Die erste Frage, die die Startseite beantwortet.
//
// Vorher stand diese Liste als HTML-Zeichenkette in `page.tsx`: jede Zeile ein
// Template-Literal mit rund zehn Inline-Stilen, die Symbole als SVG-Fragmente
// in einem Objekt daneben. Hier ist sie eine Komponente. Die Reihenfolge ist
// unveraendert und traegt eine Aussage: zuerst wer auf eine Antwort von MIR
// wartet, dann Geld, dann was still geworden ist, zuletzt was auf ANDERE
// wartet, denn das ist informativ und keine Aufgabe.
//
// Zeilen mit der Zahl null erscheinen nicht. Eine Aufgabe, die es nicht gibt,
// soll keinen Platz brauchen.

import Link from "next/link";
import { AnimateIcon } from "@/components/animate-ui/icons/icon";
import { Inbox } from "@/components/animate-ui/icons/inbox";
import { ClipboardList } from "@/components/animate-ui/icons/clipboard-list";
import { MessageCircle } from "@/components/animate-ui/icons/message-circle";
import { MessageSquareDot } from "@/components/animate-ui/icons/message-square-dot";
import { Banknote } from "@/components/animate-ui/icons/banknote";
import { Activity } from "@/components/animate-ui/icons/activity";
import { Send } from "@/components/animate-ui/icons/send";

const SYMBOL = {
  inbox: Inbox,
  check: ClipboardList,
  doc: MessageCircle,
  reply: MessageSquareDot,
  coin: Banknote,
  pulse: Activity,
  send: Send,
} as const;

export type Aufgabe = {
  /** Wie viele. Bei 0 faellt die Zeile weg. */
  n: number;
  titel: string;
  /** Der eine Satz darunter: warum das hier steht. */
  meta: string;
  href: string;
  symbol: keyof typeof SYMBOL;
  /** CSS-Variable, die den Ton der Zeile setzt (Warnung, Info, still). */
  ton: string;
};

export function Arbeitsliste({ aufgaben }: { aufgaben: Aufgabe[] }) {
  const offen = aufgaben.filter((a) => a.n > 0);

  if (offen.length === 0) {
    return (
      <div className="flex items-center gap-2.5 border-t border-[var(--line)] px-6 py-5 text-[13px] text-[var(--fg-3)]">
        <ClipboardList size={15} className="shrink-0" />
        Nichts offen. Keine Anfrage, keine Antwort und keine Auszahlung wartet auf dich.
      </div>
    );
  }

  return (
    <div>
      {offen.map((a) => {
        const Symbol = SYMBOL[a.symbol];
        return (
          // Die Bewegung haengt an der ZEILE, nicht am Symbol: 30 Pixel Kachel
          // zu treffen ist eine Uebung, eine ganze Zeile trifft man beilaeufig.
          <AnimateIcon key={a.titel} animateOnHover>
            <Link
              href={a.href}
              className="flex items-center gap-3.5 border-t border-[var(--line)] px-6 py-3.5 no-underline transition-colors hover:bg-[var(--surface-2)]"
            >
              <span
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--line)]"
                style={{ color: a.ton }}
              >
                <Symbol size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold text-[var(--fg)]">{a.titel}</span>
                <span className="block truncate text-[11.5px] text-[var(--fg-3)]">{a.meta}</span>
              </span>
              {/* Bewusst KEIN NumberTicker: der startet bei null und federt
                  erst nach der Hydration hoch. Bei einer Arbeitsliste ist die
                  Null eine Falschaussage, denn die Zeile steht nur da, WEIL die
                  Zahl ueber null liegt. Beim Rastern der hellen Fassung am
                  2026-08-25 stand genau das im Bild: sieben Zeilen, alle null.
                  Die Bewegung in dieser Zeile liefert das Symbol.
                  Der Ton wiederholt sich auf der Zahl, damit die Zeile von
                  links nach rechts dieselbe Dringlichkeit traegt. */}
              <span
                className="[font-family:var(--font-mono)] text-[15px] font-bold tabular-nums"
                style={{ color: a.ton }}
              >
                {a.n}
              </span>
            </Link>
          </AnimateIcon>
        );
      })}
    </div>
  );
}
