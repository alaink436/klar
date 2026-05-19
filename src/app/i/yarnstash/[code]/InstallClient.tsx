"use client";

// Yarn-Stash influencer invite + clipboard deferred-deeplink.
//
// iOS clipboard writes only work inside a user gesture, so cold-install
// attribution hinges on the user tapping the button: the tap writes
// `ysref:<CODE>:v1` to the clipboard, then redirects to the App Store.
// A best-effort write on mount covers Android/desktop (no gesture needed).
//
// APP-SIDE CONTRACT (not yet implemented in the app): on first launch the
// Yarn-Stash app must read the clipboard, match /^ysref:(.+):v1$/, and pass
// the captured code through capturePendingReferral() (services/referral.ts).
// Today the app only reads `?ref=` via expo-linking (warm/universal-link
// path), so this token is forward-compatible: harmless now, live the moment
// the clipboard read ships in an app build.

import { useEffect, useRef, useState } from "react";

// Atelier light palette (constants/theme.ts, verbatim from the handoff).
const T = {
  bone: "#FAF6F0",
  paper: "#FFFFFF",
  ink: "#1E1A17",
  mute: "#756B62",
  faint: "#A8A099",
  hair: "rgba(30,26,23,0.10)",
  rose: "#B84A5C",
  roseSoft: "#F2DCD8",
  roseInk: "#7E2A38",
  chip: "#F2EDE5",
};

// Yarn-Stash is iOS-only today (no Play listing — Android RC key missing).
// Everyone goes to the App Store; revisit when Android ships.
const APP_STORE_URL = "https://apps.apple.com/app/id6761712550";
const AUTO_REDIRECT_MS = 6000;

function storeUrl(code: string): string {
  return code
    ? `${APP_STORE_URL}?ref=${encodeURIComponent(code)}`
    : APP_STORE_URL;
}

export function InstallClient({ code }: { code: string }) {
  const [redirecting, setRedirecting] = useState(false);
  const redirected = useRef(false);

  const token = `ysref:${code}:v1`;

  useEffect(() => {
    // Cookie (warm-path / web continuity) is best effort.
    try {
      document.cookie = `ys_ref=${code}; max-age=${60 * 60 * 24 * 30}; path=/; SameSite=Lax`;
    } catch {
      /* ignore */
    }
    // Android/desktop usually allow clipboard without a gesture.
    void writeClipboard();
    // Safety redirect for users who never tap (they lose the clipboard
    // attribution but still land on the App Store).
    const t = setTimeout(() => go(), AUTO_REDIRECT_MS);
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
    // Inside the user gesture: this is the clipboard write that works on iOS.
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
        background: T.bone,
        color: T.ink,
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: "100%",
          textAlign: "center",
          background: T.paper,
          border: `1px solid ${T.hair}`,
          borderRadius: 28,
          padding: "44px 32px",
          boxShadow: "0 8px 40px rgba(40,30,24,0.06)",
        }}
      >
        <div
          style={{
            width: 76,
            height: 76,
            margin: "0 auto 26px",
            borderRadius: 22,
            background: `linear-gradient(150deg, ${T.roseInk}, ${T.rose})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 10px 28px ${T.rose}33`,
          }}
        >
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <circle
              cx="20"
              cy="20"
              r="13"
              stroke="white"
              strokeWidth="2.4"
              opacity="0.95"
            />
            <path
              d="M11 16c5 3.2 13 3.2 18 0M9.5 22c6 4 15 4 21 0M13 28c4 2.2 10 2.2 14 0"
              stroke="white"
              strokeWidth="2.2"
              strokeLinecap="round"
              opacity="0.9"
            />
            <path
              d="M27 28c3.4 1.8 3.4 6 0 8"
              stroke="white"
              strokeWidth="2.2"
              strokeLinecap="round"
              opacity="0.9"
            />
          </svg>
        </div>

        <p
          style={{
            fontFamily: "var(--ys-editorial), Georgia, serif",
            fontStyle: "italic",
            fontSize: 16,
            color: T.rose,
            margin: "0 0 10px",
            letterSpacing: 0.2,
          }}
        >
          Empfehlung
        </p>
        <h1
          style={{
            fontFamily: "var(--ys-display), Georgia, serif",
            fontSize: 34,
            fontWeight: 400,
            margin: "0 0 14px",
            letterSpacing: -0.4,
            color: T.ink,
          }}
        >
          My Yarn Stash
        </h1>
        <p
          style={{
            fontSize: 15,
            color: T.mute,
            margin: "0 0 30px",
            lineHeight: 1.6,
          }}
        >
          Dein Garn-Stash, deine Projekte und passende Anleitungen. Ruhig,
          übersichtlich, an einem Ort.
        </p>

        <button
          type="button"
          onClick={onOpen}
          disabled={redirecting}
          style={{
            width: "100%",
            padding: "16px 24px",
            background: redirecting ? T.roseInk : T.rose,
            color: "white",
            border: "none",
            borderRadius: 16,
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: 0.2,
            cursor: redirecting ? "wait" : "pointer",
            transition: "background 160ms ease",
          }}
        >
          {redirecting ? "Weiterleiten" : "Im App Store öffnen"}
        </button>

        <p
          style={{
            fontSize: 12.5,
            color: T.faint,
            margin: "16px 0 0",
            lineHeight: 1.55,
          }}
        >
          Tippe auf öffnen, dann wird deine Empfehlung der Installation
          automatisch zugeordnet.
        </p>

        <p
          style={{
            fontSize: 11,
            color: T.faint,
            margin: "24px 0 0",
            fontWeight: 600,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          Für iPhone und iPad
        </p>
      </div>
    </main>
  );
}
