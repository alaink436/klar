// Klar Control · Creators.
//
// Server component, 2FA-gated wie der Rest von /admin. Zeigt je Creator den
// Kurzlink (getklar.org/<app>/<handle>), den Detour-Link dahinter und wie viele
// angemeldete Nutzer ihm in der App zugeordnet sind, darunter diese Nutzer
// selbst. Anlegen und Entfernen gehen an /admin/creators/save. Die Daten
// kommen aus src/lib/creators.ts.

import { Users } from "lucide-react";
import { requireAdminPage } from "../../../lib/adminGuard";
import { CREATOR_APPS, USER_LIST_LIMIT, fetchCreators } from "../../../lib/creators";
import { getApps } from "../../../lib/adminApps";
import { AdminTopbar } from "../AdminTopbar";
import { Kennzahlen } from "../Kennzahlen";
import { EntfernenKnopf } from "./EntfernenKnopf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { TextureCard } from "@/components/ui/texture-card";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const mono = { fontFamily: "var(--font-mono)", fontSize: 12.5 } as const;
const tabelle = "rounded-none border-0 bg-transparent [&_th]:bg-transparent";

// Farbe als Inline-Stil: `a{color:inherit}` in _shared.ts schlaegt jede Tailwind-Textfarbe.
function LinkZelle({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ ...mono, color: "var(--fg)", overflowWrap: "anywhere" }}>
      {href.replace(/^https:\/\//, "")}
    </a>
  );
}

export default async function CreatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  await requireAdminPage();
  const sp = await searchParams;
  const { creators, users, errors } = await fetchCreators();
  const zugeordnet = creators.reduce((n, c) => n + c.referrals, 0);
  const pro = users.filter((u) => u.pro).length;
  const verbunden = getApps();
  const apps = CREATOR_APPS.map((c) => ({ slug: c.slug, name: verbunden.find((a) => a.slug === c.slug)?.name ?? c.slug }));

  return (
    <>
      <title>Creators · Klar Control</title>
      <AdminTopbar titel="Creators" />
      <div className="content">
        <PageHeader eyebrow="Klar Control" icon={<Users />} title="Creators">
          Wer einen Link hat und wie viele Nutzer über ihn gekommen sind. Gezählt wird, wer sich nach dem Klick in der App
          angemeldet hat.
        </PageHeader>

        <Kennzahlen
          zahlen={[
            { label: "Creators", wert: creators.length, zusatz: "mit eigenem Link" },
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

        <h2>Neuer Creator</h2>
        <TextureCard className="mb-8 p-5">
          <form method="POST" action="/admin/creators/save" data-klar-leeren="ja" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="action" value="add" />
            {apps.length === 1 ? (
              <input type="hidden" name="app" value={apps[0].slug} />
            ) : (
              <label className="grid gap-1.5 text-[12px] text-fg-3">
                App
                <select name="app" className="h-9 rounded-md border bg-transparent px-2 text-[13px] text-fg">
                  {apps.map((a) => (
                    <option key={a.slug} value={a.slug}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
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

        <h2>Links</h2>
        {creators.length === 0 ? (
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
                  {creators.map((c) => (
                    <tr key={`${c.appSlug}:${c.handle}`}>
                      <td>
                        <div className="text-fg">{c.name}</div>
                        <div className="text-[12px] text-fg-3" style={{ fontFamily: "var(--font-mono)" }}>
                          {c.appName} · {c.handle}
                          {c.status !== "active" ? ` · ${c.status}` : ""}
                        </div>
                      </td>
                      <td>
                        <LinkZelle href={c.shortLink} />
                      </td>
                      <td>
                        <LinkZelle href={c.link} />
                      </td>
                      <td style={{ ...mono, textAlign: "right" }}>{c.referrals}</td>
                      <td style={{ textAlign: "right" }}>
                        <EntfernenKnopf app={c.appSlug} handle={c.handle} name={c.name} />
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
                    <th>Zugeordnet am</th>
                    <th style={{ textAlign: "right" }}>Pro</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={`${u.assignedAt}:${i}`}>
                      <td className="text-fg">{u.name}</td>
                      <td>{u.creator}</td>
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
