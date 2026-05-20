// ThrottleUp (Moto-Maintenance) affiliate-onboarding hosted on getklar.org —
// no dedicated throttleup-web repo yet, klar carries the landing.

import { use } from "react";
import { getApp, sbGet } from "@/lib/adminApps";
import { SetupClient } from "./SetupClient";

export const dynamic = "force-dynamic";

interface Influencer {
  id: string;
  handle: string;
  display_name: string | null;
  status: string;
  share_pct: number;
  share_months: number;
  language: string;
  setup_token_expires_at: string | null;
}

async function loadInfluencer(token: string): Promise<Influencer | null> {
  const app = getApp("moto");
  if (!app) return null;
  const rows = await sbGet(
    app,
    `influencers?setup_token=eq.${encodeURIComponent(token)}&select=id,handle,display_name,status,share_pct,share_months,language,setup_token_expires_at`,
  );
  const row = (rows[0] as Influencer | undefined) ?? null;
  if (!row) return null;
  if (row.setup_token_expires_at && new Date(row.setup_token_expires_at) < new Date()) return null;
  return row;
}

export default function ThrottleUpSetupPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const data = use(loadInfluencer(token));

  if (!data) return <Status expired />;
  if (data.status === "active") return <Status alreadyDoneHandle={data.handle} />;

  return (
    <SetupClient
      token={token}
      handle={data.handle}
      displayName={data.display_name ?? ""}
      sharePct={data.share_pct}
      shareMonths={data.share_months}
    />
  );
}

function Status({ alreadyDoneHandle, expired }: { alreadyDoneHandle?: string; expired?: boolean }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#16110D",
        color: "#F5EFE3",
        padding: 24,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 440,
          textAlign: "center",
          background: "rgba(245, 239, 227, 0.06)",
          border: "1px solid rgba(245, 239, 227, 0.12)",
          borderRadius: 24,
          padding: "44px 32px",
        }}
      >
        <h1
          style={{
            fontFamily: "'Boldonse', Georgia, serif",
            fontSize: 28,
            fontWeight: 400,
            margin: "0 0 12px",
            letterSpacing: -0.4,
            color: "#F5EFE3",
          }}
        >
          {alreadyDoneHandle ? `@${alreadyDoneHandle} ✓` : expired ? "Link abgelaufen" : "ThrottleUp"}
        </h1>
        <p style={{ fontSize: 15, color: "rgba(245, 239, 227, 0.65)", lineHeight: 1.55 }}>
          {alreadyDoneHandle
            ? "Du bist bereits als Affiliate eingerichtet. Bei Fragen: alain@getklar.org"
            : expired
            ? "Dein Onboarding-Link ist abgelaufen oder ungültig. Schreib uns kurz an alain@getklar.org, wir erneuern ihn."
            : "Lade noch …"}
        </p>
      </div>
    </main>
  );
}
