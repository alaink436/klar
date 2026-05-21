// ThrottleUp (Moto-Maintenance) affiliate-onboarding hosted on getklar.org.
// Loads Boldonse (display + italic) + Inter (body) + JetBrains Mono (mono)
// via next/font and exposes them as the shared --font-* CSS variables.

import { use } from "react";
import { Boldonse, Inter, JetBrains_Mono } from "next/font/google";
import { getApp, sbGet } from "@/lib/adminApps";
import { SetupClient } from "./SetupClient";
import "../../_shared/affiliate-onboarding.css";

export const dynamic = "force-dynamic";

const boldonseDisplay = Boldonse({ weight: "400", subsets: ["latin"], variable: "--font-display", display: "swap" });
const boldonseItalic = Boldonse({ weight: "400", subsets: ["latin"], variable: "--font-italic", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const jbm = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

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

export default function ThrottleUpSetupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const data = use(loadInfluencer(token));

  const fontVars = `${boldonseDisplay.variable} ${boldonseItalic.variable} ${inter.variable} ${jbm.variable}`;

  return (
    <div className={fontVars} data-brand="throttleup">
      {data ? (
        data.status === "active" ? (
          <Status alreadyDoneHandle={data.handle} />
        ) : (
          <SetupClient
            token={token}
            handle={data.handle}
            displayName={data.display_name ?? ""}
          />
        )
      ) : (
        <Status expired />
      )}
    </div>
  );
}

function Status({ alreadyDoneHandle, expired }: { alreadyDoneHandle?: string; expired?: boolean }) {
  return (
    <main className="aff-stage">
      <div className="aff-shell" style={{ maxWidth: 440 }}>
        <div className="aff-card aff-pad" style={{ textAlign: "center" }}>
          <h1 className="aff-h1" style={{ marginBottom: 12 }}>
            {alreadyDoneHandle ? <>@{alreadyDoneHandle} <span className="italic">✓</span></> : expired ? <>Link <span className="italic">abgelaufen</span></> : <span className="italic">Lade …</span>}
          </h1>
          <p className="aff-lede" style={{ textAlign: "center" }}>
            {alreadyDoneHandle
              ? "Du bist bereits als Affiliate eingerichtet. Bei Fragen: alain@getklar.org"
              : expired
              ? "Dein Onboarding-Link ist abgelaufen oder ungültig. Schreib uns kurz an alain@getklar.org, wir erneuern ihn."
              : ""}
          </p>
        </div>
      </div>
    </main>
  );
}
