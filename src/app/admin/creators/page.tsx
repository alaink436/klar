// Klar Control · Creators.
//
// Server component, 2FA-gated wie der Rest von /admin. Ganz oben alle Creator in
// einer Liste, von der Plattform und von Hand angelegt (lib/allCreators, seit
// 2026-10-22). Darunter die Apps, je mit Marke, ob sie Detour hat, und dem Link
// auf ihr Creator Kit; darunter das Formular fuer einen neuen Creator, die Links
// (filterbar nach App) und die Nutzer, die ueber einen Link kamen.
// Geschrieben wird ueber /admin/creators/save, gelesen ueber src/lib/creators.ts.

import Link from "next/link";
import { Users } from "lucide-react";
import { requireAdminPage } from "../../../lib/adminGuard";
import { USER_LIST_LIMIT, fetchCreators } from "../../../lib/creators";
import { mergeCreators, type AnyCreator } from "../../../lib/allCreators";
import { listCreatorAccounts } from "../../../lib/creatorAccounts";
import { latestModelRun, monthEarnings } from "../../../lib/creatorEarnings";
import { creatorPostLines } from "../../../lib/postCheck";
import { balances } from "../../../lib/payouts";
import { AdminTopbar } from "../AdminTopbar";
import { Kennzahlen } from "../Kennzahlen";
import { AppAuswahl, AppDialog, BestaetigenKnopf } from "./CreatorDialoge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { TextureCard } from "@/components/ui/texture-card";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const mono = { fontFamily: "var(--font-mono)", fontSize: 12.5 } as const;
const tabelle = "rounded-none border-0 bg-transparent [&_th]:bg-transparent";

/** Creator Kit je App (Logo, Store-Screenshots, Film, About-Text) auf Google Drive,
    angelegt 2026-10-14. Schluessel ist `klar_creator_apps.slug`. */
const creatorKits: Record<string, string> = {
  basalt: "https://drive.google.com/drive/folders/1RffgGteAJpQPj0xBxrWS4DNYX4v7HoT0",
  pocketmate: "https://drive.google.com/drive/folders/10nMoWWWbrB9F3658ZcD66oyeez47G6xB", // Ordner heisst MyLoo
  "anime-vault": "https://drive.google.com/drive/folders/11an26m-Vn1IuQhQqzxFVg1JwZowMuRlB",
  "yarn-stash": "https://drive.google.com/drive/folders/1jjH_wvBEJ8zePYyYCEDAmcjtLfwhGMyG",
  kelva: "https://drive.google.com/drive/folders/1YQCBUEelc-3KTc_btcDAuLF7GqpuTAhU",
  learnbound: "https://drive.google.com/drive/folders/1KDBdQFVayleMSgpTqwJT75crxNjRhTtZ",
};

// Farbe als Inline-Stil: `a{color:inherit}` in _shared.ts schlaegt jede Tailwind-Textfarbe.
function LinkZelle({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ ...mono, color: "var(--fg)", overflowWrap: "anywhere" }}>
      {href.replace(/^https:\/\//, "")}
    </a>
  );
}

const usd = (cents: number | null) => (cents === null ? "–" : `$${(cents / 100).toFixed(2)}`);
const STATUS: Record<AnyCreator["status"], [string, string]> = {
  verified: ["bestätigt", "var(--success)"],
  waiting: ["wartet auf Bio-Code", "var(--warning)"],
  paused: ["pausiert", "var(--warning)"],
  closed: ["geschlossen", "var(--danger)"],
  unconnected: ["kein TikTok", "var(--fg-4)"],
  manual: ["aktiv", "var(--success)"],
};

function DetourMarke({ an }: { an: boolean }) {
  return (
    <span className="klar-marke">
      <span className="klar-punkt" style={{ background: an ? "var(--success)" : "var(--warning)" }} aria-hidden="true" />
      {an ? "Detour" : "kein Detour"}
    </span>
  );
}

export default async function CreatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string; app?: string }>;
}) {
  await requireAdminPage();
  const sp = await searchParams;
  const [{ apps, creators, users, errors }, accounts, run, owed] = await Promise.all([
    fetchCreators(),
    listCreatorAccounts(),
    latestModelRun(),
    balances().catch(() => []),
  ]);
  const [earnings, postLines] = await Promise.all([run ? monthEarnings(run.month) : [], creatorPostLines(accounts)]);
  const alle = mergeCreators({
    accounts,
    manual: creators,
    appNames: Object.fromEntries(apps.map((a) => [a.slug, a.name])),
    monthCents: new Map(earnings.map((e) => [e.creator_id, e.payable_cents])),
    owedCents: new Map(owed.map((b) => [b.creatorId, b.owedCents])),
    postLines,
  });
  const vonPlattform = alle.filter((c) => c.origin === "platform").length;
  const filter = apps.some((a) => a.slug === sp.app) ? sp.app : undefined;
  const sichtbar = filter ? creators.filter((c) => c.appSlug === filter) : creators;
  const zugeordnet = creators.reduce((n, c) => n + (c.referrals ?? 0), 0);
  const pro = users.filter((u) => u.pro).length;
  const mitCreators = apps.filter((a) => a.creators > 0);

  return (
    <>
      <title>Creators · Klar Control</title>
      <AdminTopbar titel="Creators" />
      <div className="content">
        <PageHeader eyebrow="Klar Control" icon={<Users />} title="Creators">
          Alle Creator, von der Plattform und von Hand angelegt. Darunter die Apps und die Links: gezählt wird, wer sich
          nach dem Klick in der App angemeldet hat, und nur bei Apps mit Detour.
        </PageHeader>

        <Kennzahlen
          zahlen={[
            { label: "Creators", wert: alle.length, zusatz: `${vonPlattform} von der Plattform, ${alle.length - vonPlattform} von Hand` },
            { label: "Zugeordnet", wert: zugeordnet, zusatz: "angemeldete Nutzer über einen Link" },
            {
              label: "Davon Pro",
              wert: pro,
              zusatz: zugeordnet > users.length ? `unter den letzten ${USER_LIST_LIMIT}` : "haben gerade Pro",
            },
          ]}
        />

        {sp.msg || sp.err ? (
          <TextureCard className="mb-4 px-5 py-3.5 text-[12.5px] text-fg-2">{sp.err ?? sp.msg}</TextureCard>
        ) : null}
        {errors.map((e) => (
          <TextureCard key={e} className="mb-3 p-5 text-[13px] text-fg-3">
            {e}
          </TextureCard>
        ))}

        <h2>Alle Creator</h2>
        <TextureCard className="mb-8">
          <div style={{ overflowX: "auto" }}>
            <table className={tabelle}>
              <thead>
                <tr>
                  <th>Creator</th>
                  <th>App</th>
                  <th>Herkunft</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Follower</th>
                  <th>Posts</th>
                  <th>Link</th>
                  <th style={{ textAlign: "right" }}>Zugeordnet</th>
                  <th style={{ textAlign: "right" }}>Diesen Monat</th>
                  <th style={{ textAlign: "right" }}>Offen</th>
                </tr>
              </thead>
              <tbody>
                {alle.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-fg-3">
                      Noch keine Creator.
                    </td>
                  </tr>
                ) : (
                  alle.map((c) => (
                    <tr key={c.key}>
                      <td>
                        <a href={`https://www.tiktok.com/@${c.handle}`} target="_blank" rel="noopener noreferrer" style={{ ...mono, color: "var(--fg)" }}>
                          @{c.handle}
                        </a>
                      </td>
                      <td>{c.appName}</td>
                      <td>{c.origin === "platform" ? "Plattform" : "von Hand"}</td>
                      <td>
                        <span className="klar-marke">
                          <span className="klar-punkt" style={{ background: STATUS[c.status][1] }} aria-hidden="true" />
                          {STATUS[c.status][0]}
                        </span>
                      </td>
                      <td style={{ ...mono, textAlign: "right" }}>{c.followers === null ? "–" : c.followers.toLocaleString("de-CH")}</td>
                      <td>{c.posts ?? "–"}</td>
                      <td>{c.shortLink ? <LinkZelle href={`https://${c.shortLink.replace(/^https:\/\//, "")}`} /> : c.hasLink ? "ja" : "–"}</td>
                      <td style={{ ...mono, textAlign: "right" }}>{c.referrals ?? "–"}</td>
                      <td style={{ ...mono, textAlign: "right" }}>{usd(c.monthCents)}</td>
                      <td style={{ ...mono, textAlign: "right" }}>{usd(c.owedCents)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TextureCard>

        <div className="flex items-end justify-between gap-3">
          <h2>Apps</h2>
          <div className="mb-3">
            <AppDialog />
          </div>
        </div>
        <TextureCard className="mb-8">
          <div style={{ overflowX: "auto" }}>
            <table className={tabelle}>
              <thead>
                <tr>
                  <th>App</th>
                  <th>Kurzlinks</th>
                  <th>Detour</th>
                  <th>Creator Kit</th>
                  <th style={{ textAlign: "right" }}>Creators</th>
                  <th aria-label="Aktionen" />
                </tr>
              </thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.slug}>
                    <td className="text-fg">{a.name}</td>
                    <td style={mono}>getklar.org/{a.shortPath}/…</td>
                    <td>
                      <DetourMarke an={!!a.detourLink} />
                    </td>
                    <td>
                      {creatorKits[a.slug] ? (
                        <a
                          href={creatorKits[a.slug]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-fg-2 underline decoration-white/25 underline-offset-4 transition-colors hover:text-fg hover:decoration-white/60"
                        >
                          Drive-Ordner
                        </a>
                      ) : (
                        "–"
                      )}
                    </td>
                    <td style={{ ...mono, textAlign: "right" }}>{a.creators}</td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <AppDialog
                          app={{
                            slug: a.slug,
                            name: a.name,
                            shortPath: a.shortPath,
                            detourLink: a.detourLink ?? "",
                            storeUrl: a.storeUrl ?? "",
                          }}
                        />
                        {a.creators === 0 ? (
                          <BestaetigenKnopf
                            label="Entfernen"
                            titel={`${a.name} entfernen?`}
                            text="Die App verschwindet aus dieser Liste, ihre Kurzlinks gibt es danach nicht mehr."
                            felder={{ action: "app-remove", slug: a.slug }}
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TextureCard>

        <h2>Neuer Creator</h2>
        <TextureCard className="mb-8 p-5">
          <form method="POST" action="/admin/creators/save" data-klar-leeren="ja" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="action" value="add" />
            <div className="grid min-w-[180px] gap-1.5 text-[12px] text-fg-3">
              App
              <AppAuswahl
                apps={apps.map((a) => ({ slug: a.slug, name: a.name, detour: !!a.detourLink }))}
                wert={filter ?? apps.find((a) => a.detourLink)?.slug}
              />
            </div>
            <label className="grid min-w-[180px] flex-1 gap-1.5 text-[12px] text-fg-3">
              Name
              <Input name="name" placeholder="Tony Stark" required maxLength={80} />
            </label>
            <label className="grid min-w-[160px] flex-1 gap-1.5 text-[12px] text-fg-3">
              Handle, wird zum Link
              <Input name="handle" placeholder="tonystark" required maxLength={32} pattern="@?[A-Za-z0-9_.\-]{1,32}" />
            </label>
            <Button type="submit" variant="pill" className="h-9 px-5 text-[13px]">
              Anlegen
            </Button>
          </form>
        </TextureCard>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2>Links</h2>
          {mitCreators.length > 1 ? (
            <div className="klar-segment mb-3" role="tablist" aria-label="App">
              <Link href="/admin/creators" role="tab" aria-selected={!filter}>
                Alle
              </Link>
              {mitCreators.map((a) => (
                <Link key={a.slug} href={`/admin/creators?app=${a.slug}`} role="tab" aria-selected={filter === a.slug}>
                  {a.name}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
        {sichtbar.length === 0 ? (
          <TextureCard className="mb-8 p-5 text-[13px] text-fg-3">Noch keine Creators.</TextureCard>
        ) : (
          <TextureCard className="mb-8">
            <div style={{ overflowX: "auto" }}>
              <table className={tabelle}>
                <thead>
                  <tr>
                    <th>Creator</th>
                    <th>Kurzlink</th>
                    <th>Detour-Link</th>
                    <th style={{ textAlign: "right" }}>Zugeordnet</th>
                    <th aria-label="Aktion" />
                  </tr>
                </thead>
                <tbody>
                  {sichtbar.map((c) => (
                    <tr key={`${c.appSlug}:${c.handle}`}>
                      <td>
                        <div className="text-fg">{c.name}</div>
                        <div className="text-[12px] text-fg-3" style={{ fontFamily: "var(--font-mono)" }}>
                          {c.appName} · {c.handle}
                        </div>
                      </td>
                      <td>
                        <LinkZelle href={c.shortLink} />
                      </td>
                      <td>{c.link ? <LinkZelle href={c.link} /> : <DetourMarke an={false} />}</td>
                      <td style={{ ...mono, textAlign: "right" }}>{c.referrals ?? "–"}</td>
                      <td style={{ textAlign: "right" }}>
                        <BestaetigenKnopf
                          label="Entfernen"
                          titel={`${c.name} entfernen?`}
                          text="Sein Kurzlink geht danach nicht mehr. Wer schon über ihn gekommen ist, bleibt ihm zugeordnet."
                          felder={{ action: "remove", app: c.appSlug, handle: c.handle }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TextureCard>
        )}

        <h2>Nutzer über einen Link</h2>
        {users.length === 0 ? (
          <TextureCard className="p-5 text-[13px] text-fg-3">Noch niemand über einen Creator-Link gekommen.</TextureCard>
        ) : (
          <TextureCard>
            <div style={{ overflowX: "auto" }}>
              <table className={tabelle}>
                <thead>
                  <tr>
                    <th>Nutzer</th>
                    <th>Creator</th>
                    <th>App</th>
                    <th>Zugeordnet am</th>
                    <th style={{ textAlign: "right" }}>Pro</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={`${u.assignedAt}:${i}`}>
                      <td className="text-fg">{u.name}</td>
                      <td>{u.creator}</td>
                      <td>{u.app}</td>
                      <td style={mono}>{new Date(u.assignedAt).toLocaleDateString("de-CH")}</td>
                      <td style={{ ...mono, textAlign: "right" }}>{u.pro ? "Pro" : "nein"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TextureCard>
        )}
      </div>
    </>
  );
}
