"use client";

// Promillo influencer landing + clipboard deferred-deeplink.
//
// iOS clipboard writes only work inside a user gesture, so cold-install
// attribution hinges on the user tapping the button: the tap writes
// `promilloref:<CODE>:v1` to the clipboard, then redirects to the App Store.
// A best-effort write on mount covers Android/desktop (no gesture needed).
// The app reads the token once on first cold start (services/referral.ts).
//
// Visual identity = the Promillo design system (constants/promillo.ts):
// brand red on a warm red gradient, cream card, 3D animal crew, Fredoka
// display + Nunito body, pill buttons. Party energy, no balloons missing.

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

// Promillo palette — verbatim from the app's constants/promillo.ts.
const T = {
  brand: "#E8423B",
  brandDeep: "#C2332D",
  warm: "#FF7A4D",
  cream: "#F4EEE2",
  paper: "#FFFDF8",
  ink: "#1a1411",
  ink55: "rgba(26,20,17,0.55)",
  ink45: "rgba(26,20,17,0.45)",
  gold: "#F0A93D",
  green: "#23A06A",
  hair: "rgba(26,20,17,0.10)",
};

// Promillo iOS App Store ID (ASC 6773104290, "Promillo Party Games").
const APP_STORE_URL = "https://apps.apple.com/app/id6773104290";
const FORCE_REDIRECT_MS = 2000;

function storeUrl(code: string): string {
  return code
    ? `${APP_STORE_URL}?ref=${encodeURIComponent(code)}`
    : APP_STORE_URL;
}

export function InstallClient({ code }: { code: string }) {
  const [redirecting, setRedirecting] = useState(false);
  const redirected = useRef(false);

  const token = `promilloref:${code}:v1`;

  useEffect(() => {
    try {
      document.cookie = `pm_ref=${code}; max-age=${60 * 60 * 24 * 30}; path=/; SameSite=Lax`;
    } catch {
      /* ignore */
    }
    // Skip auto-redirect on desktop (no iOS/Android app to install there) and
    // on ?preview for dev screenshots. Mobile keeps the fast cold-install path.
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
    const isPreview =
      typeof window !== "undefined" && window.location.search.includes("preview");
    if (!isMobile || isPreview) {
      // Still write the clipboard best-effort so a desktop tap on the button
      // also captures the code — the page just doesn't navigate by itself.
      if (code) void writeClipboard().catch(() => undefined);
      return;
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
        padding: "24px 18px",
        position: "relative",
        overflow: "hidden",
        color: T.ink,
        // Brand-red party gradient, like the app's game-card plates.
        background: `linear-gradient(135deg, ${T.warm} 0%, ${T.brand} 48%, ${T.brandDeep} 100%)`,
        fontFamily: "var(--pm-body), 'Nunito', system-ui, sans-serif",
      }}
    >
      {/* Confetti dots — static, cheap, no animation needed for a redirect page. */}
      {[
        { x: "8%", y: "12%", s: 10, c: T.gold, r: 12 },
        { x: "86%", y: "9%", s: 8, c: "#fff", r: -8 },
        { x: "78%", y: "26%", s: 12, c: T.gold, r: 24 },
        { x: "12%", y: "78%", s: 9, c: "#fff", r: 8 },
        { x: "90%", y: "70%", s: 11, c: T.gold, r: -16 },
        { x: "22%", y: "30%", s: 7, c: "#fff", r: 30 },
      ].map((d, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            position: "absolute",
            left: d.x,
            top: d.y,
            width: d.s,
            height: d.s,
            borderRadius: i % 2 ? 2 : 99,
            background: d.c,
            opacity: 0.7,
            transform: `rotate(${d.r}deg)`,
            pointerEvents: "none",
          }}
        />
      ))}

      {/* 3D animal crew — unicorn peeking top-left, fox bottom-right. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "calc(50% - 250px)",
          top: "calc(50% - 270px)",
          width: 150,
          height: 150,
          transform: "rotate(-8deg)",
          pointerEvents: "none",
          filter: "drop-shadow(0 16px 22px rgba(60, 10, 6, 0.35))",
        }}
      >
        <Image
          src="/affiliate-mascots/promillio/unicorn.png"
          alt=""
          fill
          sizes="150px"
          style={{ objectFit: "contain" }}
          priority
        />
      </div>
      <div
        aria-hidden
        style={{
          position: "absolute",
          right: "calc(50% - 250px)",
          bottom: "calc(50% - 250px)",
          width: 120,
          height: 120,
          transform: "rotate(10deg)",
          pointerEvents: "none",
          filter: "drop-shadow(0 14px 18px rgba(60, 10, 6, 0.35))",
        }}
      >
        <Image
          src="/affiliate-mascots/promillio/fox.png"
          alt=""
          fill
          sizes="120px"
          style={{ objectFit: "contain" }}
        />
      </div>

      <article
        style={{
          position: "relative",
          maxWidth: 420,
          width: "100%",
          background: T.cream,
          borderRadius: 26,
          padding: "40px 28px 28px",
          boxShadow:
            `0 0 0 2px rgba(255,255,255,0.35),` +
            `0 28px 70px -24px rgba(60, 10, 6, 0.45),` +
            `0 10px 22px -12px rgba(60, 10, 6, 0.3)`,
        }}
      >
        {/* Eyebrow row: app icon left + invite chip right. */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <span
            style={{
              width: 46,
              height: 46,
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: `0 6px 14px -4px ${T.brand}66, 0 0 0 1px ${T.hair}`,
              position: "relative",
              flexShrink: 0,
            }}
          >
            <Image
              src="/icons/promillio.png"
              alt="Promillo icon"
              fill
              sizes="46px"
              style={{ objectFit: "cover" }}
              priority
            />
          </span>
          {code ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 11px",
                background: "#fff",
                color: T.brand,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 1.4,
                textTransform: "uppercase",
                borderRadius: 999,
                border: `1.5px solid ${T.brand}33`,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: 6, background: T.brand }} />
              Empf. · {code}
            </span>
          ) : (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1.8,
                textTransform: "uppercase",
                color: T.ink45,
              }}
            >
              Party Games
            </span>
          )}
        </header>

        {/* Headline. */}
        <h1
          style={{
            fontFamily: "var(--pm-display), 'Fredoka', system-ui, sans-serif",
            fontSize: 44,
            fontWeight: 700,
            margin: "0 0 4px",
            letterSpacing: -0.8,
            color: T.ink,
            lineHeight: 1,
          }}
        >
          Promillo
          <span style={{ color: T.brand }}>.</span>
        </h1>
        <p
          style={{
            fontFamily: "var(--pm-display), 'Fredoka', system-ui, sans-serif",
            fontSize: 17,
            fontWeight: 600,
            color: T.brand,
            margin: "0 0 18px",
            letterSpacing: 0.1,
          }}
        >
          ein Handy. eine Party. sieben Spiele.
        </p>

        <p
          style={{
            fontSize: 15.5,
            fontWeight: 500,
            color: T.ink,
            margin: "0 0 22px",
            lineHeight: 1.55,
          }}
        >
          Imposter, Ich hab noch nie, Wer würde eher und mehr. Handy
          rumgeben, lachen, trinken wer dran ist. Kein Material, keine
          Vorbereitung.
        </p>

        {/* Feature pills — like the FREE badges on the hub cards. */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            margin: "0 0 26px",
          }}
        >
          {[
            ["🎭", "Imposter-Modus"],
            ["🍻", "7 Trinkspiele"],
            ["🌍", "5 Sprachen"],
            ["🆓", "Gratis spielbar"],
          ].map(([emoji, label]) => (
            <span
              key={label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "8px 13px",
                background: "#fff",
                borderRadius: 999,
                border: `1.5px solid ${T.hair}`,
                fontSize: 13.5,
                fontWeight: 700,
                color: T.ink,
                boxShadow: "0 2px 6px rgba(40, 20, 10, 0.05)",
              }}
            >
              <span aria-hidden>{emoji}</span>
              {label}
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
            background: redirecting ? T.brandDeep : T.brand,
            color: "#fff",
            border: "none",
            borderRadius: 999,
            fontFamily: "var(--pm-display), 'Fredoka', system-ui, sans-serif",
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: 0.3,
            cursor: redirecting ? "wait" : "pointer",
            transition: "transform 90ms ease, box-shadow 90ms ease",
            boxShadow: `0 10px 24px -8px ${T.brand}AA`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
          onMouseDown={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.985)";
          }}
          onMouseUp={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "";
          }}
        >
          <span>{redirecting ? "App Store…" : "Im App Store öffnen"}</span>
          <span aria-hidden style={{ fontSize: 17, opacity: 0.9 }}>→</span>
        </button>

        <p
          style={{
            fontSize: 11.5,
            color: T.ink55,
            margin: "16px 0 0",
            lineHeight: 1.55,
            textAlign: "center",
          }}
        >
          {code
            ? "Tippe öffnen, die Empfehlung wird der Installation automatisch zugeordnet."
            : "Für iPhone. Auch ohne Empfehlungscode."}
        </p>

        {/* Footer colophon. */}
        <footer
          style={{
            marginTop: 24,
            paddingTop: 13,
            borderTop: `1.5px dashed ${T.hair}`,
            display: "flex",
            justifyContent: "space-between",
            fontSize: 10,
            color: T.ink45,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          <span>Promillo · 16+ · drink responsibly</span>
          <span>{code || "v1"}</span>
        </footer>
      </article>
    </main>
  );
}
