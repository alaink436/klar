"use client";

// ThrottleUp influencer landing + clipboard deferred-deeplink.
//
// Mirrors the yarnstash pattern: tap writes `motoref:<CODE>:v1` to the
// clipboard (matched by Moto-app services/referral.ts Shape-B), then
// redirects to the App Store. iOS-without-gesture rejects the clipboard
// write, so the button tap is what makes cold-install attribution work.
// Best-effort write on mount covers Android/desktop, where the API
// resolves without a gesture.
//
// Visual identity = ThrottleUp's garage-workshop look (amber/charcoal,
// Boldonse display + Inter body), matched against the in-app constants.

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

// ThrottleUp palette — workshop amber on warm charcoal.
const T = {
  bg: "#16110D",
  surface: "#1F1815",
  ink: "#F6EDDD",
  mute: "#A89B86",
  faint: "#6B6258",
  hair: "rgba(246,237,221,0.10)",
  amber: "#F2A03A",
  amberSoft: "#3A2A18",
  amberInk: "#FFCC7A",
  chip: "#2A211C",
};

// ThrottleUp iOS App Store ID (live 2026-05).
const APP_STORE_URL = "https://apps.apple.com/app/id6761712527";
// Hard fallback in case the clipboard promise never settles. Same reasoning
// as yarnstash — iOS rejects fast without gesture, Android/desktop resolve
// in 50-200ms, so the auto-redirect fires right after the clipboard write
// completes, this timer is the impossible-case safety net.
const FORCE_REDIRECT_MS = 2000;

function storeUrl(code: string): string {
  return code
    ? `${APP_STORE_URL}?ref=${encodeURIComponent(code)}`
    : APP_STORE_URL;
}

export function InstallClient({ code }: { code: string }) {
  const [redirecting, setRedirecting] = useState(false);
  const redirected = useRef(false);

  const token = `motoref:${code}:v1`;

  useEffect(() => {
    try {
      document.cookie = `moto_ref=${code}; max-age=${60 * 60 * 24 * 30}; path=/; SameSite=Lax`;
    } catch {
      /* ignore */
    }
    const clipboardP = code ? writeClipboard().catch(() => undefined) : Promise.resolve();
    void clipboardP.then(() => go());
    const t = setTimeout(() => go(), FORCE_REDIRECT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function writeClipboard(): Promise<void> {
    if (!code) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(token);
      }
    } catch {
      /* clipboard blocked without gesture -> covered by the button tap */
    }
  }

  function go(): void {
    if (redirected.current) return;
    redirected.current = true;
    setRedirecting(true);
    window.location.href = storeUrl(code);
  }

  async function onOpen(): Promise<void> {
    await writeClipboard();
    go();
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          `radial-gradient(circle at 80% 0%, ${T.amberSoft} 0%, transparent 55%), ` +
          `radial-gradient(circle at 0% 100%, #2B1F18 0%, transparent 60%), ${T.bg}`,
        color: T.ink,
        padding: 24,
        position: "relative",
      }}
    >
      <div
        style={{
          maxWidth: 440,
          width: "100%",
          textAlign: "center",
          background: T.surface,
          border: `1px solid ${T.hair}`,
          borderRadius: 28,
          padding: "44px 32px 32px",
          boxShadow:
            "0 1px 0 rgba(255,204,122,0.04) inset, 0 24px 60px -20px rgba(0,0,0,0.55)",
        }}
      >
        <div
          style={{
            width: 92,
            height: 92,
            margin: "0 auto 16px",
            borderRadius: 22,
            overflow: "hidden",
            boxShadow: `0 14px 36px -10px rgba(242, 160, 58, 0.40), 0 0 0 1px ${T.hair}`,
            position: "relative",
          }}
        >
          <Image
            src="/icons/moto.webp"
            alt="ThrottleUp"
            fill
            sizes="92px"
            style={{ objectFit: "cover" }}
            priority
          />
        </div>

        {code && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "5px 12px",
              borderRadius: 999,
              background: T.amberSoft,
              color: T.amberInk,
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 1.4,
              textTransform: "uppercase",
              margin: "0 0 14px",
              fontFamily: "var(--tu-body), 'Inter', system-ui, sans-serif",
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: 5, background: T.amber }} />
            Empfehlung · {code}
          </div>
        )}

        <h1
          style={{
            fontFamily: "var(--tu-display), 'Boldonse', system-ui, sans-serif",
            fontSize: 36,
            fontWeight: 400,
            margin: "0 0 8px",
            letterSpacing: -0.4,
            color: T.ink,
            lineHeight: 1.05,
          }}
        >
          ThrottleUp
        </h1>
        <p
          style={{
            fontFamily: "var(--tu-body), 'Inter', system-ui, sans-serif",
            fontStyle: "italic",
            fontSize: 17,
            color: T.amber,
            margin: "0 0 16px",
            letterSpacing: 0.1,
          }}
        >
          let it rip.
        </p>
        <p
          style={{
            fontFamily: "var(--tu-body), 'Inter', system-ui, sans-serif",
            fontSize: 14.5,
            color: T.mute,
            margin: "0 0 26px",
            lineHeight: 1.55,
            maxWidth: 320,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Dein Build-Log, dein Parts-Ledger, deine Garage in der Hosentasche.
          Foto, Beleg, Service-Datum, alles an einem Ort.
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: 6,
            marginBottom: 26,
          }}
        >
          {["Build-Log", "Parts-Ledger", "Service-Tracker"].map((feat) => (
            <span
              key={feat}
              style={{
                fontSize: 11,
                color: T.mute,
                background: T.chip,
                border: `1px solid ${T.hair}`,
                padding: "5px 10px",
                borderRadius: 999,
                fontWeight: 500,
                fontFamily: "var(--tu-body), 'Inter', system-ui, sans-serif",
              }}
            >
              {feat}
            </span>
          ))}
        </div>

        <button
          type="button"
          onClick={onOpen}
          disabled={redirecting}
          style={{
            width: "100%",
            padding: "16px 24px",
            background: redirecting
              ? "#C97E1F"
              : `linear-gradient(135deg, ${T.amber} 0%, #D9821E 100%)`,
            color: "#1A1410",
            border: "none",
            borderRadius: 14,
            fontFamily: "var(--tu-display), system-ui, sans-serif",
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: 0.4,
            cursor: redirecting ? "wait" : "pointer",
            transition: "background 160ms ease",
            boxShadow: `0 14px 28px -10px ${T.amber}`,
          }}
        >
          {redirecting ? "App Store wird geöffnet…" : "Im App Store öffnen"}
        </button>

        {code && (
          <p
            style={{
              fontFamily: "var(--tu-body), 'Inter', system-ui, sans-serif",
              fontSize: 12.5,
              color: T.faint,
              margin: "16px 0 0",
              lineHeight: 1.55,
            }}
          >
            Tippe auf öffnen, dann wird deine Empfehlung der Installation
            automatisch zugeordnet.
          </p>
        )}

        <p
          style={{
            fontSize: 11,
            color: T.faint,
            margin: "24px 0 0",
            fontWeight: 600,
            letterSpacing: 1,
            textTransform: "uppercase",
            fontFamily: "var(--tu-body), 'Inter', system-ui, sans-serif",
            fontStyle: "italic",
          }}
        >
          Für iPhone und iPad
        </p>
      </div>
    </main>
  );
}
