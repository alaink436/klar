"use client";

// Client shell around the account graph: holds the selection, shows the picked
// account beside the map, and lists everything that needs a decision underneath.
// Kept separate from AccountMap so the graph stays a pure rendering component
// and the server page hands down plain data.
//
// Redesign 2026-10-08 (Ticket 03): Kennzahlen, Karte, Detail und offene Punkte
// stehen als Karten mit glaenzender Kante; Status nur noch als Punkt.

import { useMemo, useState, type CSSProperties } from "react";
import AccountMap from "./AccountMap";
import { Kennzahlen } from "@/app/admin/Kennzahlen";
import { TextureCard, TextureCardHeader, TextureCardTitle } from "@/components/ui/texture-card";
import {
  APPS,
  ROLE_LABEL,
  PLATFORM_LABEL,
  accountKey,
  totals,
  type SocialAccount,
} from "@/lib/socialAccounts";

const fmt = new Intl.NumberFormat("de-CH");

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-line bg-white/[.02] px-4 py-3">
      <div className="[font-family:var(--font-mono)] text-[9.5px] font-medium uppercase tracking-[0.14em] text-fg-3">
        {label}
      </div>
      <div className="mt-1.5 text-[22px] font-medium leading-none tracking-[-0.025em] text-fg tabular-nums">
        {value}
      </div>
      {hint ? <div className="mt-1.5 text-[11px] text-fg-4">{hint}</div> : null}
    </div>
  );
}

/** Status nur als Punkt: Warnung oder kritisch. */
function FlagPunkt({ level }: { level: string }) {
  return (
    <span
      aria-hidden="true"
      className="klar-punkt mt-[7px]"
      style={{ "--ton": level === "crit" ? "var(--danger)" : "var(--warning)" } as CSSProperties}
    />
  );
}

function Detail({ a }: { a: SocialAccount }) {
  const app = APPS.find((x) => x.key === a.app);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="[font-family:var(--font-mono)] text-[9.5px] font-medium uppercase tracking-[0.14em] text-fg-3">
          {app?.name} · {PLATFORM_LABEL[a.platform]} · {ROLE_LABEL[a.role]}
        </div>
        <div className="mt-1.5 [font-family:var(--font-mono)] text-[15px] font-medium text-fg break-all">
          {a.handle ? `@${a.handle}` : "Handle offen"}
        </div>
        {a.displayName ? (
          <div className="mt-0.5 text-[12px] text-fg-3">Anzeigename &bdquo;{a.displayName}&ldquo;</div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Follower" value={a.followers === undefined ? "—" : fmt.format(a.followers)} />
        <Stat label="Likes" value={a.likes === undefined ? "—" : fmt.format(a.likes)} />
      </div>

      <dl className="m-0 flex flex-col gap-2 text-[12px]">
        <div className="flex justify-between gap-3 border-b border-line pb-2">
          <dt className="text-fg-4">Blotato</dt>
          <dd className="m-0 [font-family:var(--font-mono)] text-fg">
            {a.blotatoId ? a.blotatoId : "nicht verbunden"}
          </dd>
        </div>
        {a.login ? (
          <div className="flex justify-between gap-3 border-b border-line pb-2">
            <dt className="shrink-0 text-fg-4">Login</dt>
            <dd className="m-0 [font-family:var(--font-mono)] text-[11px] text-fg break-all text-right">{a.login}</dd>
          </div>
        ) : null}
        {a.measuredAt ? (
          <div className="flex justify-between gap-3">
            <dt className="text-fg-4">Zahlen vom</dt>
            <dd className="m-0 [font-family:var(--font-mono)] text-fg">{a.measuredAt}</dd>
          </div>
        ) : null}
      </dl>

      {a.flags?.length ? (
        <div className="flex flex-col gap-2">
          {a.flags.map((f, i) => (
            <p
              key={i}
              className="m-0 flex gap-2.5 rounded-[var(--radius-sm)] bg-white/[.03] px-3 py-2 text-[12px] leading-relaxed text-fg-2"
            >
              <FlagPunkt level={f.level} />
              {f.text}
            </p>
          ))}
        </div>
      ) : null}

      {a.handle && a.platform === "tiktok" ? (
        <a
          className="[font-family:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-fg-3 underline underline-offset-4 hover:text-fg"
          href={`https://www.tiktok.com/@${a.handle}`}
          target="_blank"
          rel="noreferrer"
        >
          Profil öffnen ↗
        </a>
      ) : null}
    </div>
  );
}

export default function AccountBoard({ accounts }: { accounts: SocialAccount[] }) {
  const [active, setActive] = useState<SocialAccount | null>(null);
  const t = useMemo(() => totals(accounts), [accounts]);

  const flagged = useMemo(
    () =>
      accounts
        .filter((a) => a.flags?.length)
        .sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0)),
    [accounts],
  );

  return (
    <div className="flex flex-col gap-3">
      <Kennzahlen
        className="mb-0"
        zahlen={[
          { label: "Follower gesamt", wert: fmt.format(t.followers), zusatz: "ohne Instagram" },
          { label: "Likes gesamt", wert: fmt.format(t.likes) },
          { label: "Accounts", wert: String(t.accounts) },
          { label: "In Blotato", wert: `${t.linked} / ${t.accounts}`, zusatz: `${t.accounts - t.linked} nur von Hand bespielbar` },
        ]}
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_300px]">
        <TextureCard className="h-[calc(100vh-260px)] min-h-[600px]">
          <AccountMap accounts={accounts} onSelect={setActive} activeKey={active ? accountKey(active) : null} />
        </TextureCard>

        <TextureCard className="p-5">
          {active ? (
            <Detail a={active} />
          ) : (
            <div className="flex h-full flex-col justify-center gap-2 text-center">
              <div className="[font-family:var(--font-mono)] text-[9.5px] font-medium uppercase tracking-[0.14em] text-fg-3">
                Kein Account gewählt
              </div>
              <p className="m-0 text-[13px] leading-relaxed text-fg-3">
                Einen Knoten anklicken, um Zahlen, Login-Adresse und offene Punkte zu sehen.
              </p>
            </div>
          )}
        </TextureCard>
      </div>

      {flagged.length ? (
        <TextureCard>
          <TextureCardHeader className="pb-3">
            <TextureCardTitle>Was offen ist</TextureCardTitle>
          </TextureCardHeader>
          <ul className="m-0 flex list-none flex-col gap-2.5 px-6 pb-5 pt-0">
            {flagged.flatMap((a) =>
              (a.flags ?? []).map((f, i) => (
                <li key={`${accountKey(a)}-${i}`} className="grid grid-cols-[auto_auto_1fr] gap-x-2.5 gap-y-1 text-[13px] leading-relaxed">
                  <FlagPunkt level={f.level} />
                  <button
                    type="button"
                    onClick={() => setActive(a)}
                    className="self-start [font-family:var(--font-mono)] text-[11.5px] font-medium text-fg underline decoration-[var(--line-strong)] underline-offset-4 hover:decoration-[var(--fg)]"
                  >
                    {a.handle ? `@${a.handle}` : "Handle offen"}
                  </button>
                  <span className="text-fg-3">{f.text}</span>
                </li>
              )),
            )}
          </ul>
        </TextureCard>
      ) : null}
    </div>
  );
}
