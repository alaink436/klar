// Klar Studios · Bewerbungen, oben: wer sich selbst auf getklar.org/dashboard
// als Creator angemeldet hat (klar_creator_accounts). Bis 2026-10-22 stand das
// nirgends in Klar Control, die erste echte Anmeldung fiel nur in der Datenbank auf.

import { TextureCard } from "@/components/ui/texture-card";
import { listCreatorAccounts, type AccountStatus } from "@/lib/creatorAccounts";

const STATUS: Record<AccountStatus, string> = {
  waiting: "wartet auf Bio-Code",
  verified: "bestätigt",
  paused: "pausiert",
  closed: "geschlossen",
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("de-CH", {
    timeZone: "Europe/Zurich",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export default async function Anmeldungen() {
  // Eigene Testkonten (klar_test…@getklar.org) bleiben draussen, wie die Testanfragen in der Inbox.
  const accounts = (await listCreatorAccounts()).filter((a) => !a.email.startsWith("klar_test"));
  return (
    <TextureCard className="mx-9 mt-3 shrink-0 p-5 max-[820px]:mx-4">
      <h2 className="m-0">Creator-Anmeldungen</h2>
      {accounts.length === 0 ? (
        <p className="mt-2 text-[13px] text-fg-3">Noch niemand hat sich auf getklar.org angemeldet.</p>
      ) : (
        <div className="mt-3 max-h-[260px] overflow-y-auto">
          <table data-klar-griffe="nein" className="w-full text-[13px] tabular-nums">
            <thead className="text-left text-fg-3">
              <tr>
                <th className="py-1.5 font-normal">Creator</th>
                <th className="py-1.5 font-normal">Land</th>
                <th className="py-1.5 font-normal">Link</th>
                <th className="py-1.5 font-normal">Status</th>
                <th className="py-1.5 text-right font-normal">angemeldet</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-t border-[var(--hair)]">
                  <td className="py-2">
                    <a href={`https://www.tiktok.com/@${a.tiktok_handle}`} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                      @{a.tiktok_handle}
                    </a>
                    <span className="block text-[12px] text-fg-3">{a.email}</span>
                  </td>
                  <td className="py-2">{a.country}</td>
                  <td className="py-2">{a.has_link ? "ja" : "nein"}</td>
                  <td className="py-2">
                    {STATUS[a.status]}
                    {a.status === "waiting" && <span className="block text-[12px] text-fg-3">Code {a.bio_code}</span>}
                  </td>
                  <td className="py-2 text-right">{when(a.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </TextureCard>
  );
}
