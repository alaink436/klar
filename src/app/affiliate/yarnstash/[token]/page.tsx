// Yarn-Stash affiliate-onboarding hosted on getklar.org because Yarn-Stash
// doesn't have its own dedicated web-repo (the iOS app is the only product
// surface, klar hosts the landing). Token comes from the admin /api/
// affiliate/approve flow that mints in the Yarn-Stash Supabase.

import { use } from "react";
import { Gloock, Newsreader } from "next/font/google";
import { getApp, sbGet } from "@/lib/adminApps";
import { SetupClient } from "./SetupClient";
import { t, isLang, type Lang } from "./translations";

export const dynamic = "force-dynamic";

const display = Gloock({
  weight: "400",
  subsets: ["latin"],
  variable: "--ys-display",
  display: "swap",
});

const editorial = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--ys-editorial",
  display: "swap",
});

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
  const app = getApp("yarn-stash");
  if (!app) return null;
  const rows = await sbGet(
    app,
    `influencers?setup_token=eq.${encodeURIComponent(token)}&select=id,handle,display_name,status,share_pct,share_months,language,setup_token_expires_at`,
  );
  const row = (rows[0] as Influencer | undefined) ?? null;
  if (!row) return null;
  if (row.setup_token_expires_at && new Date(row.setup_token_expires_at) < new Date()) {
    return null;
  }
  return row;
}

export default function YarnStashSetupPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { token } = use(params);
  const sp = use(searchParams);
  const data = use(loadInfluencer(token));
  const lang: Lang = isLang(sp.lang) ? sp.lang : isLang(data?.language) ? (data!.language as Lang) : "de";

  return (
    <div className={`${display.variable} ${editorial.variable}`}>
      {data ? (
        data.status === "active" ? (
          <Status lang={lang} alreadyDoneHandle={data.handle} />
        ) : (
          <SetupClient
            token={token}
            handle={data.handle}
            displayName={data.display_name ?? ""}
            sharePct={data.share_pct}
            shareMonths={data.share_months}
            lang={lang}
          />
        )
      ) : (
        <Status lang={lang} expired />
      )}
    </div>
  );
}

function Status({ lang, alreadyDoneHandle, expired }: { lang: Lang; alreadyDoneHandle?: string; expired?: boolean }) {
  const tt = t(lang);
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle at 80% 0%, #F2DCD8 0%, transparent 50%), " +
          "radial-gradient(circle at 0% 100%, #EBE0CE 0%, transparent 55%), #FAF6F0",
        color: "#1E1A17",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 440,
          textAlign: "center",
          background: "#FFFFFF",
          border: "1px solid rgba(30,26,23,0.10)",
          borderRadius: 28,
          padding: "44px 32px",
          boxShadow: "0 24px 60px -20px rgba(40,30,24,0.12)",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--ys-display), 'Gloock', Georgia, serif",
            fontSize: 32,
            fontWeight: 400,
            margin: "0 0 12px",
            letterSpacing: -0.4,
            lineHeight: 1.05,
          }}
        >
          {alreadyDoneHandle ? `@${alreadyDoneHandle} ✓` : expired ? tt.expired_title : "My Yarn Stash"}
        </h1>
        <p style={{ fontSize: 15, color: "#756B62", lineHeight: 1.55 }}>
          {alreadyDoneHandle ? tt.already_done_body : expired ? tt.expired_body : tt.loading}
        </p>
      </div>
    </main>
  );
}
