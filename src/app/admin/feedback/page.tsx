// Klar Control · Klar Studios · Feedback, erster Reiter UserJot: die Wuensche auf den
// UserJot-Boards der Apps (ein Workspace, ein Board pro App), nach Stimmen
// sortiert. Nur lesen; Stand setzen, antworten und den Changelog schreiben geht
// in UserJot selbst. Daten aus lib/userjot, der Token liegt im Vault.

import { ExternalLink, MessagesSquare } from "lucide-react";
import { requireAdminPage } from "@/lib/adminGuard";
import {
  REQUEST_STATUS_LABELS,
  USERJOT_APPS,
  UserjotError,
  boardUrl,
  fetchRequests,
  findUserjotApp,
  type RequestStatus,
  type UserjotRequest,
} from "@/lib/userjot";
import { TextureCard } from "@/components/ui/texture-card";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { inZone } from "@/lib/zeit";
import { AdminTopbar } from "../AdminTopbar";
import { FeedbackReiter } from "./FeedbackReiter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TON: Record<RequestStatus, string | undefined> = {
  pending: undefined,
  review: "var(--info)",
  planned: "var(--info)",
  in_progress: "var(--warning)",
  completed: "var(--success)",
  closed: "var(--fg-3)",
};

const datum = (iso: string) => inZone(iso, { day: "2-digit", month: "short", year: "numeric" });
const stimmen = (n: number) => (n === 1 ? "1 Stimme" : `${n} Stimmen`);
const kommentare = (n: number) => (n === 1 ? "1 Kommentar" : `${n} Kommentare`);

export default async function UserjotPage({ searchParams }: { searchParams: Promise<{ app?: string }> }) {
  await requireAdminPage();

  const app = findUserjotApp((await searchParams).app) ?? USERJOT_APPS[0];
  let fehler: string | null = null;
  let wuensche: UserjotRequest[] = [];
  try {
    wuensche = await fetchRequests(app);
  } catch (e) {
    if (!(e instanceof UserjotError)) throw e;
    fehler = e.message;
  }

  return (
    <>
      <title>UserJot · Feedback · Klar Control</title>
      <AdminTopbar titel="UserJot" bereich="Klar Studios" />
      <div className="content">
        <PageHeader eyebrow="Klar Studios · Feedback" icon={<MessagesSquare />} title="UserJot">
          Die Wünsche auf den UserJot-Boards der Apps, die meisten Stimmen zuerst. Stand setzen und antworten geht in
          UserJot.
        </PageHeader>

        <FeedbackReiter aktiv="userjot" />

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <nav className="klar-segment" aria-label="App">
            {USERJOT_APPS.map((a) => (
              <a key={a.slug} href={`/admin/feedback?app=${a.slug}`} aria-current={a.slug === app.slug ? "page" : undefined}>
                {a.name}
              </a>
            ))}
          </nav>
          <Button asChild variant="pill-dark" size="sm">
            <a href={boardUrl(app)} target="_blank" rel="noreferrer">
              <ExternalLink />
              Board
            </a>
          </Button>
          <Button asChild variant="pill-dark" size="sm">
            <a href="https://app.userjot.com" target="_blank" rel="noreferrer">
              <ExternalLink />
              In UserJot verwalten
            </a>
          </Button>
        </div>

        {fehler ? (
          <TextureCard className="mb-4 flex items-start gap-3 px-5 py-4 text-[13px] text-fg-2">
            <span aria-hidden="true" className="klar-punkt mt-[7px]" style={{ "--ton": "var(--danger)" } as React.CSSProperties} />
            <div className="min-w-0">
              <b className="text-fg">UserJot nicht lesbar.</b> {fehler}
            </div>
          </TextureCard>
        ) : (
          <TextureCard>
            {wuensche.length === 0 ? (
              <p className="m-0 px-4 py-8 text-center text-[12.5px] text-fg-3">Noch keine Wünsche.</p>
            ) : (
              <ul className="m-0 list-none p-0">
                {wuensche.map((w) => (
                  <li key={w.id} className="border-t px-4 py-3 first:border-t-0">
                    <div className="flex items-start gap-3">
                      <span
                        aria-hidden="true"
                        className="klar-punkt mt-[7px]"
                        style={TON[w.status] ? ({ "--ton": TON[w.status] } as React.CSSProperties) : undefined}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-medium text-fg">{w.title}</div>
                        {w.body ? <p className="m-0 mt-1 line-clamp-2 text-[12.5px] text-fg-2">{w.body}</p> : null}
                        <div className="mt-1.5 text-[11.5px] text-fg-3">
                          {[REQUEST_STATUS_LABELS[w.status], stimmen(w.votes), kommentare(w.comments), w.createdAt ? datum(w.createdAt) : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TextureCard>
        )}
      </div>
    </>
  );
}
