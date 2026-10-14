// Klar Control · Creators.
//
// Server component, 2FA-gated wie der Rest von /admin. Zeigt je Creator den
// Affiliate-Link, den Short Link aus dem Detour-Dashboard und wie viele
// angemeldete Nutzer ihm in der App zugeordnet sind. Die Daten kommen aus
// src/lib/creators.ts; angelegt wird ein Creator in der Supabase der App
// (`influencers`), nicht hier.

import { Users } from "lucide-react";
import { requireAdminPage } from "../../../lib/adminGuard";
import { fetchCreators } from "../../../lib/creators";
import { AdminTopbar } from "../AdminTopbar";
import { Kennzahlen } from "../Kennzahlen";
import { PageHeader } from "@/components/ui/page-header";
import { TextureCard } from "@/components/ui/texture-card";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const mono = { fontFamily: "var(--font-mono)", fontSize: 12.5 } as const;

// Farbe als Inline-Stil: `a{color:inherit}` in _shared.ts schlaegt jede Tailwind-Textfarbe.
function LinkZelle({ href }: { href: string | null }) {
  if (!href) return <span className="text-fg-4">noch keiner</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ ...mono, color: "var(--fg)", overflowWrap: "anywhere" }}>
      {href.replace(/^https:\/\//, "")}
    </a>
  );
}

export default async function CreatorsPage() {
  await requireAdminPage();
  const { creators, errors } = await fetchCreators();
  const zugeordnet = creators.reduce((n, c) => n + c.referrals, 0);

  return (
    <>
      <title>Creators · Klar Control</title>
      <AdminTopbar titel="Creators" />
      <div className="content">
        <PageHeader eyebrow="Klar Control" icon={<Users />} title="Creators">
          Wer einen Affiliate-Link hat und wie viele Nutzer über ihn gekommen sind. Gezählt wird, wer sich nach dem Klick
          in der App angemeldet hat.
        </PageHeader>

        <Kennzahlen
          zahlen={[
            { label: "Creators", wert: creators.length, zusatz: "mit eigenem Link" },
            { label: "Zugeordnet", wert: zugeordnet, zusatz: "angemeldete Nutzer über einen Link" },
          ]}
        />

        {errors.map((e) => (
          <TextureCard key={e} className="mb-3 p-5 text-[13px] text-fg-3">
            {e}
          </TextureCard>
        ))}

        {creators.length === 0 ? (
          <TextureCard className="p-5 text-[13px] text-fg-3">Noch keine Creators.</TextureCard>
        ) : (
          <TextureCard>
            <div style={{ overflowX: "auto" }}>
              <table className="rounded-none border-0 bg-transparent [&_th]:bg-transparent">
                <thead>
                  <tr>
                    <th>Creator</th>
                    <th>App</th>
                    <th>Affiliate-Link</th>
                    <th>Short Link</th>
                    <th style={{ textAlign: "right" }}>Zugeordnet</th>
                  </tr>
                </thead>
                <tbody>
                  {creators.map((c) => (
                    <tr key={`${c.app}:${c.handle}`}>
                      <td>
                        <div className="text-fg">{c.name}</div>
                        <div className="text-[12px] text-fg-3" style={{ fontFamily: "var(--font-mono)" }}>
                          {c.handle}
                          {c.status !== "active" ? ` · ${c.status}` : ""}
                        </div>
                      </td>
                      <td>{c.app}</td>
                      <td>
                        <LinkZelle href={c.link} />
                      </td>
                      <td>
                        <LinkZelle href={c.shortLink} />
                      </td>
                      <td style={{ ...mono, textAlign: "right" }}>{c.referrals}</td>
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
