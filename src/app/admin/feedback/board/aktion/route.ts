// POST /admin/feedback/board/aktion: alles, was das Board schreibt. Ein
// Formularfeld `tat` sagt, was; die Arbeit macht lib/board. Zurueck geht es auf
// die Board-Seite, mit `msg` oder `err` fuer die Meldung.

import { NextResponse, type NextRequest } from "next/server";
import { requireAdminRoute } from "@/lib/adminGuard";
import {
  BoardError,
  IDEA_STATUS_LABELS,
  addComment,
  createIdea,
  findBoardApp,
  handleReport,
  markWishRead,
  promoteWish,
  setIdeaStatus,
  setIdeaWeight,
  updateIdeaText,
  type IdeaStatus,
} from "@/lib/board";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdminRoute(req, "login");
  if (!auth.ok) return auth.response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.redirect(new URL("/admin/feedback/board?err=Kein+Formular", req.url), 303);
  }
  const feld = (name: string, max: number) => String(form.get(name) ?? "").slice(0, max);
  const app = findBoardApp(feld("app", 40));
  const ansicht = feld("ansicht", 20);
  const id = feld("id", 40);
  const wunsch = feld("wunsch", 40);
  const text = (): { title: string; detail: string } => ({ title: feld("titel", 400), detail: feld("beschreibung", 2000) });

  // Zurueck in dieselbe Ansicht, mit derselben Idee oder demselben Wunsch.
  const zurueck = (r: { msg?: string; err?: string; id?: string }) => {
    const q = new URLSearchParams();
    if (app) q.set("app", app.slug);
    if (ansicht === "wuensche" || ansicht === "meldungen") q.set("ansicht", ansicht);
    const idee = r.id ?? id;
    if (idee) q.set("id", idee);
    if (wunsch) q.set("wunsch", wunsch);
    if (r.msg) q.set("msg", r.msg);
    if (r.err) q.set("err", r.err);
    return NextResponse.redirect(new URL(`/admin/feedback/board?${q}`, req.url), 303);
  };
  if (!app) return zurueck({ err: "Unbekannte App." });

  try {
    switch (feld("tat", 20)) {
      case "anlegen":
        return zurueck({ id: await createIdea(app, text()), msg: "Idee angelegt und übersetzt." });
      case "text":
        await updateIdeaText(app, id, text());
        return zurueck({ msg: "Gespeichert und übersetzt." });
      case "stand": {
        const stand = feld("stand", 20);
        await setIdeaStatus(app, id, stand);
        return zurueck({ msg: `Stand: ${IDEA_STATUS_LABELS[stand as IdeaStatus]}.` });
      }
      case "gewicht":
        await setIdeaWeight(app, id, feld("gewicht", 10));
        return zurueck({ msg: "Gewicht gesetzt." });
      case "kommentar":
        await addComment(app, id, feld("text", 4000));
        return zurueck({ msg: "Kommentar gespeichert und übersetzt." });
      case "aufs-board":
        await promoteWish(app, wunsch, text());
        return zurueck({ msg: "Steht als Idee auf dem Board." });
      case "gelesen":
        await markWishRead(app, wunsch);
        return zurueck({ msg: "Als gelesen markiert." });
      case "sperren":
        await handleReport(app, feld("event", 40), feld("konto", 40), true);
        return zurueck({ msg: "Gesperrt. Das Event zeigt jetzt einen neutralen Namen." });
      case "stehen-lassen": {
        const n = await handleReport(app, feld("event", 40), feld("konto", 40), false);
        return zurueck({ msg: n === 1 ? "1 Meldung erledigt, der Name bleibt." : `${n} Meldungen erledigt, der Name bleibt.` });
      }
      default:
        return zurueck({ err: "Unbekannte Aktion." });
    }
  } catch (e) {
    if (e instanceof BoardError) return zurueck({ err: e.message });
    throw e;
  }
}
