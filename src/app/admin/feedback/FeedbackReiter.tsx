// Umschalter oben im Bereich Feedback: die UserJot-Boards der Apps, das
// Postfach mit den Support-Mails und "Neu in Basalt". Alles ist, was Nutzer
// zurueckmelden, darum ein Bereich.
//
// Seit 2026-10-23 (Alain: "damit es uebersichtlicher ist") oeffnet Feedback
// gleich UserJot. Das Board der Apps ("what i want next") hat UserJot in Basalt
// ersetzt; seine Seite bleibt hinten als "Neu in Basalt", weil dort die Ideen
// mit Version und Uebersetzung stehen, aus denen Basalt nach einem
// Store-Update das Blatt "Neu in Basalt" zeigt.

import Link from "next/link";

export function FeedbackReiter({ aktiv }: { aktiv: "userjot" | "postfach" | "board" }) {
  return (
    <nav className="klar-segment mb-4" aria-label="Feedback">
      <Link href="/admin/feedback" aria-current={aktiv === "userjot" ? "page" : undefined}>
        UserJot
      </Link>
      <Link href="/admin/feedback/postfach" aria-current={aktiv === "postfach" ? "page" : undefined}>
        Postfach
      </Link>
      <Link href="/admin/feedback/board" aria-current={aktiv === "board" ? "page" : undefined}>
        Neu in Basalt
      </Link>
    </nav>
  );
}
