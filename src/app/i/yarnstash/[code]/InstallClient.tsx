"use client";

// Yarn-Stash influencer landing + clipboard deferred-deeplink.
//
// iOS clipboard writes only work inside a user gesture, so cold-install
// attribution hinges on the user tapping the button: the tap writes
// `ysref:<CODE>:v1` to the clipboard, then redirects to the App Store.
// A best-effort write on mount covers Android/desktop (no gesture needed).
//
// Visual identity = the "Atelier" design system from the Yarn-Stash app
// (constants/theme.ts), with the official app icon (/icons/yarnstash.png)
// as the brand anchor and a warm bone surface that mirrors the in-app feel.

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

// Atelier palette — verbatim from Yarn-Stash app constants/theme.ts.
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
  sand: "#EBE0CE",
  chip: "#F2EDE5",
};

// Yarn-Stash iOS App Store ID (live since 2026-05-19).
const APP_STORE_URL = "https://apps.apple.com/app/id6761712550";
// Faster fallback: clipboard is best-effort on mount and inside the button
// gesture; we don't need 6 seconds of "stare at the page" time.
const AUTO_REDIRECT_MS = 2500;

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
    try {
      document.cookie = `ys_ref=${code}; max-age=${60 * 60 * 24 * 30}; path=/; SameSite=Lax`;
    } catch {
      /* ignore */
    }
    if (code) void writeClipboard();
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
          `radial-gradient(circle at 80% 0%, ${T.roseSoft} 0%, transparent 50%), ` +
          `radial-gradient(circle at 0% 100%, ${T.sand} 0%, transparent 55%), ${T.bone}`,
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
          background: T.paper,
          border: `1px solid ${T.hair}`,
          borderRadius: 32,
          padding: "44px 32px 32px",
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.6) inset, 0 24px 60px -20px rgba(40,30,24,0.12)",
        }}
      >
        <div
          style={{
            width: 92,
            height: 92,
            margin: "0 auto 16px",
            borderRadius: 22,
            overflow: "hidden",
            boxShadow: `0 14px 36px -10px rgba(184, 74, 92, 0.45), 0 0 0 1px ${T.hair}`,
            position: "relative",
          }}
        >
          <Image
            src="/icons/yarnstash.png"
            alt="My Yarn Stash"
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
              background: T.roseSoft,
              color: T.roseInk,
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 1.4,
              textTransform: "uppercase",
              margin: "0 0 14px",
              fontFamily:
                "var(--ys-display), 'Gloock', Georgia, serif",
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: 5, background: T.rose }} />
            Empfehlung · {code}
          </div>
        )}

        <h1
          style={{
            fontFamily: "var(--ys-display), 'Gloock', Georgia, serif",
            fontSize: 36,
            fontWeight: 400,
            margin: "0 0 8px",
            letterSpacing: -0.4,
            color: T.ink,
            lineHeight: 1.05,
          }}
        >
          My Yarn Stash
        </h1>
        <p
          style={{
            fontFamily: "var(--ys-editorial), 'Newsreader', Georgia, serif",
            fontStyle: "italic",
            fontSize: 17,
            color: T.rose,
            margin: "0 0 16px",
            letterSpacing: 0.1,
          }}
        >
          stash. match. knit.
        </p>
        <p
          style={{
            fontSize: 14.5,
            color: T.mute,
            margin: "0 0 26px",
            lineHeight: 1.55,
            maxWidth: 320,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Dein Garn-Stash, deine Projekte und passende Anleitungen. Scan das
          Etikett, Vision-AI macht den Rest.
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
          {["Ravelry-Match", "Wrapper-Scan", "Foto-First"].map((feat) => (
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
              ? T.roseInk
              : `linear-gradient(135deg, ${T.rose} 0%, ${T.roseInk} 100%)`,
            color: "white",
            border: "none",
            borderRadius: 16,
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: 0.2,
            cursor: redirecting ? "wait" : "pointer",
            transition: "background 160ms ease",
            boxShadow: `0 14px 28px -10px ${T.rose}`,
          }}
        >
          {redirecting ? "App Store wird geöffnet…" : "Im App Store öffnen"}
        </button>

        {code && (
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
        )}

        <p
          style={{
            fontSize: 11,
            color: T.faint,
            margin: "24px 0 0",
            fontWeight: 600,
            letterSpacing: 1,
            textTransform: "uppercase",
            fontFamily:
              "var(--ys-editorial), 'Newsreader', Georgia, serif",
            fontStyle: "italic",
          }}
        >
          Für iPhone und iPad
        </p>
      </div>
    </main>
  );
}
