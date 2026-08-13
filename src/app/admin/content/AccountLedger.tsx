"use client";

// Bestand — der Tab, der die Frage "was habe ich eigentlich, und was läuft
// davon?" in einer Tabelle beantwortet.
//
// Die Zeile pro Account mischt zwei Sorten Wahrheit, und die Trennung ist der
// ganze Trick:
//   gemessen  — Postzahl vom öffentlichen Profil, Follower aus der Handmessung,
//               "läuft automatisch" aus der Blotato-Verbindung. Steht als Text
//               da und lässt sich hier nicht ändern; wer es ändern will, ändert
//               die Welt, nicht das Formular.
//   entschieden — Zustand, Soll pro Woche, Notiz. Das kann keine API wissen,
//               also wird es getippt und landet in klar_account_status.
//
// Genau eine Ausnahme: auf X gibt es keinen Scrape, also darf die Postzahl
// dort von Hand kommen. Wo das Profil lesbar ist, gewinnt die Messung — sonst
// pflegt man eine Zahl, die daneben schon steht.
//
// Gespeichert wird beim Verlassen des Feldes bzw. sofort beim Zustandswechsel;
// die Zeile springt optimistisch, die Server-Action läuft daneben. Ein Bestand,
// der nach jedem Zeichen nachlädt, wird nicht gepflegt.

import { Fragment, useOptimistic, useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ACCOUNT_STATES, ACCOUNT_STATE_LABEL, type AccountState } from "@/lib/accountStates";
import { updateAccountStatus } from "./account-actions";

export interface LedgerRow {
  key: string;
  handle: string;
  displayName: string | null;
  appLabel: string;
  appColor: string;
  platformLabel: string;
  roleLabel: string;
  /** Blotato kann hier posten — abgeleitet, nicht getippt. */
  automated: boolean;
  followers: number | null;
  /** Vom Profil gelesen; null wenn nicht lesbar (X, Login-Wall, Timeout). */
  nativePosts: number | null;
  /** true, wenn für diese Plattform überhaupt ein Scrape existiert. */
  scrapable: boolean;
  state: AccountState;
  targetPerWeek: number | null;
  postsManual: number | null;
  note: string;
}

const num = (n: number) => new Intl.NumberFormat("de-CH").format(n);

const FIELD =
  "h-8 px-2 text-[12px] [font-family:var(--font-body)] text-fg bg-bg border border-line rounded-[4px] focus:border-fg focus:outline-none";

export default function AccountLedger({ rows }: { rows: LedgerRow[] }) {
  const [, startTransition] = useTransition();
  const [onlyOpen, setOnlyOpen] = useState(false);

  type Patch = { key: string } & Partial<Pick<LedgerRow, "state" | "targetPerWeek" | "postsManual" | "note">>;
  const [items, patch] = useOptimistic(rows, (state: LedgerRow[], p: Patch) =>
    state.map((r) => (r.key === p.key ? { ...r, ...p } : r)),
  );

  function save(key: string, p: Omit<Patch, "key">, wire: Parameters<typeof updateAccountStatus>[1]) {
    startTransition(async () => {
      patch({ key, ...p });
      await updateAccountStatus(key, wire);
    });
  }

  /** Was auf einem Account liegt: gemessen, sonst selbst gezählt. */
  const postsOf = (r: LedgerRow) => r.nativePosts ?? r.postsManual;

  const shown = onlyOpen ? items.filter((r) => r.state !== "dropped") : items;

  const count = (s: AccountState) => items.filter((r) => r.state === s).length;
  const automated = items.filter((r) => r.automated).length;
  const postsTotal = items.reduce((sum, r) => sum + (postsOf(r) ?? 0), 0);
  const postsUnknown = items.filter((r) => postsOf(r) === null).length;
  const followersTotal = items.reduce((sum, r) => sum + (r.followers ?? 0), 0);
  const targetTotal = items
    .filter((r) => r.state === "active" || r.state === "warmup")
    .reduce((sum, r) => sum + (r.targetPerWeek ?? 0), 0);

  // Nach App gruppieren, Reihenfolge der Zeilen bleibt wie geliefert.
  const groups: { label: string; color: string; rows: LedgerRow[] }[] = [];
  for (const r of shown) {
    const last = groups[groups.length - 1];
    if (last && last.label === r.appLabel) last.rows.push(r);
    else groups.push({ label: r.appLabel, color: r.appColor, rows: [r] });
  }

  return (
    <>
      <div className="grid gap-3 mb-4 grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
        <Tile label="Accounts" value={num(items.length)} sub={`${num(automated)} über Blotato, ${num(items.length - automated)} von Hand`} />
        <Tile
          label="Zustand"
          value={`${num(count("active"))} laufen`}
          sub={`${num(count("warmup"))} wärmen auf · ${num(count("paused"))} pausiert · ${num(count("dropped"))} aufgegeben`}
        />
        <Tile
          label="Posts draussen"
          value={num(postsTotal)}
          sub={postsUnknown > 0 ? `${num(postsUnknown)} Accounts ohne lesbare Zahl` : "alle Profile gelesen"}
        />
        <Tile label="Soll pro Woche" value={num(targetTotal)} sub="über alle laufenden Accounts" />
        <Tile label="Follower" value={num(followersTotal)} sub="Handmessung, kein Live-Wert" />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-line">
          <div>
            <div className="font-semibold text-fg text-[14px]">Bestand</div>
            <p className="text-[12.5px] text-fg-3 m-0 mt-0.5 leading-relaxed">
              Zustand, Soll und Notiz werden hier gepflegt. Postzahl, Follower und &bdquo;l&auml;uft
              automatisch&ldquo; stehen daneben, weil sie gemessen sind &mdash; sie lassen sich nicht
              eintippen.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOnlyOpen((v) => !v)}
            className="[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-3 hover:text-fg"
          >
            {onlyOpen ? `Aufgegebene wieder zeigen (${count("dropped")})` : `Aufgegebene ausblenden (${count("dropped")})`}
          </button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Rolle</TableHead>
              <TableHead className="text-right">Posts</TableHead>
              <TableHead className="text-right">Soll/Woche</TableHead>
              <TableHead>Zustand</TableHead>
              <TableHead>Weg</TableHead>
              <TableHead>Notiz</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((g) => (
              <Fragment key={g.label}>
                <TableRow>
                  <TableCell colSpan={7} style={{ background: "var(--surface-2)" }}>
                    <span className="inline-flex items-center gap-2">
                      <span className="size-[8px] rounded-full" style={{ background: g.color }} />
                      <span className="[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-2">
                        {g.label}
                      </span>
                      <span className="[font-family:var(--font-mono)] text-[10px] text-fg-4">{g.rows.length}</span>
                    </span>
                  </TableCell>
                </TableRow>

                {g.rows.map((r) => (
                  <TableRow key={r.key} className={r.state === "dropped" ? "opacity-55" : undefined}>
                    <TableCell>
                      <div className="text-[13px] text-fg">
                        {r.handle ? `@${r.handle}` : <span className="text-fg-4">Handle fehlt</span>}
                      </div>
                      <div className="[font-family:var(--font-mono)] text-[10.5px] text-fg-4">
                        {r.platformLabel}
                        {r.displayName ? ` · ${r.displayName}` : ""}
                      </div>
                    </TableCell>

                    <TableCell className="text-[12.5px] text-fg-3">{r.roleLabel}</TableCell>

                    <TableCell className="text-right">
                      {r.nativePosts !== null ? (
                        <>
                          <span className="[font-family:var(--font-mono)] text-[13px] text-fg">{num(r.nativePosts)}</span>
                          <div className="[font-family:var(--font-mono)] text-[9.5px] text-fg-4">vom Profil</div>
                        </>
                      ) : (
                        <>
                          <input
                            type="number"
                            min={0}
                            defaultValue={r.postsManual ?? ""}
                            aria-label={`Selbst gezählte Posts für @${r.handle}`}
                            onBlur={(e) => {
                              const v = e.target.value.trim() === "" ? null : Number(e.target.value);
                              if (v === r.postsManual) return;
                              save(r.key, { postsManual: v }, { posts_manual: v });
                            }}
                            className={`${FIELD} w-[68px] text-right`}
                          />
                          <div className="[font-family:var(--font-mono)] text-[9.5px] text-fg-4">
                            {r.scrapable ? "Profil nicht lesbar" : "selbst gezählt"}
                          </div>
                        </>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        defaultValue={r.targetPerWeek ?? ""}
                        aria-label={`Soll-Posts pro Woche für @${r.handle}`}
                        onBlur={(e) => {
                          const v = e.target.value.trim() === "" ? null : Number(e.target.value);
                          if (v === r.targetPerWeek) return;
                          save(r.key, { targetPerWeek: v }, { target_per_week: v });
                        }}
                        className={`${FIELD} w-[62px] text-right`}
                      />
                    </TableCell>

                    <TableCell>
                      <select
                        value={r.state}
                        aria-label={`Zustand von @${r.handle}`}
                        onChange={(e) => {
                          const v = e.target.value as AccountState;
                          save(r.key, { state: v }, { state: v });
                        }}
                        className={`${FIELD} cursor-pointer`}
                      >
                        {ACCOUNT_STATES.map((s) => (
                          <option key={s} value={s}>
                            {ACCOUNT_STATE_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </TableCell>

                    <TableCell>
                      <Badge tone={r.automated ? "ok" : "neutral"}>
                        {r.automated ? "Blotato" : "von Hand"}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <input
                        type="text"
                        defaultValue={r.note}
                        placeholder="warum, seit wann, was als Nächstes"
                        aria-label={`Notiz zu @${r.handle}`}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v === r.note) return;
                          save(r.key, { note: v }, { note: v });
                        }}
                        className={`${FIELD} w-full min-w-[180px]`}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="px-5 py-4">
      <div className="[font-family:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-4">
        {label}
      </div>
      <div className="mt-1.5 text-[24px] leading-none text-fg">{value}</div>
      <div className="mt-1.5 text-[11.5px] text-fg-3 leading-snug">{sub}</div>
    </Card>
  );
}
