// Umschalter oben im Bereich Feedback: das Postfach mit den Support-Mails und
// das Board der Apps. Beides ist, was Nutzer zurueckmelden, darum ein Bereich.

import Link from "next/link";

export function FeedbackReiter({ aktiv }: { aktiv: "postfach" | "board" }) {
  return (
    <nav className="klar-segment mb-4" aria-label="Feedback">
      <Link href="/admin/feedback" aria-current={aktiv === "postfach" ? "page" : undefined}>
        Postfach
      </Link>
      <Link href="/admin/feedback/board" aria-current={aktiv === "board" ? "page" : undefined}>
        Board
      </Link>
    </nav>
  );
}
