"use client";

// Yarn-Stash influencer landing + clipboard deferred-deeplink.
//
// iOS clipboard writes only work inside a user gesture, so cold-install
// attribution hinges on the user tapping the button: the tap writes
// `ysref:<CODE>:v1` to the clipboard, then redirects to the App Store.
// A best-effort write on mount covers Android/desktop (no gesture needed).
//
// Visual identity = the "Atelier" design system from the Yarn-Stash app
// (constants/theme.ts), composed as a hand-bound paper card on a warm
// stitched surface: paper-grain background, washi-tape header, the knitting
// mascot lifted above the card, and the official app icon as the brand mark.

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

// Atelier palette — verbatim from Yarn-Stash app constants/theme.ts.
const T = {
  bone: "#FAF6F0",
  paper: "#FFFDF8",
  ink: "#1E1A17",
  mute: "#756B62",
  faint: "#A8A099",
  hair: "rgba(30,26,23,0.10)",
  rose: "#B84A5C",
  roseSoft: "#F2DCD8",
  roseInk: "#7E2A38",
  sand: "#EBE0CE",
  sandDeep: "#D9C7A8",
  chip: "#F2EDE5",
  thread: "#8A6E55",
};

// Yarn-Stash iOS App Store ID (live since 2026-05-19).
const APP_STORE_URL = "https://apps.apple.com/app/id6761712550";
const FORCE_REDIRECT_MS = 2000;

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
    // Skip auto-redirect on desktop (no iOS/Android app to install there) and
    // on ?preview for dev screenshots. Mobile keeps the fast cold-install path.
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
    const isPreview =
      typeof window !== 'undefined' && window.location.search.includes('preview');
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
        // Real cable-knit texture as the page bg (vierzehn.png — the same
        // diagonal-cable swatch the user wanted to see behind the card). The
        // image is photographic 600x600, so we let cover scale it to the
        // viewport. A warm rose wash on top keeps the brand identity.
        backgroundColor: T.bone,
        backgroundImage:
          `linear-gradient(135deg, ${T.roseSoft}66 0%, ${T.sand}33 50%, ${T.sandDeep}55 100%),` +
          `url('/img/yarnstash-knit/vierzehn.png')`,
        backgroundSize: "auto, cover",
        backgroundPosition: "center, center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Soft vignette so the card's paper edges read against the knit. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            `radial-gradient(ellipse 80% 70% at 50% 50%, transparent 0%, ${T.bone}99 65%, ${T.bone}cc 100%)`,
          pointerEvents: "none",
        }}
      />

      {/* Knitting mascot — large, off-axis, peeking from behind the card. The
          mascot is the brand. App-icons follow inside the card. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "calc(50% - 230px)",
          top: "calc(50% - 240px)",
          width: 200,
          height: 200,
          transform: "rotate(-6deg)",
          opacity: 0.95,
          pointerEvents: "none",
          filter: "drop-shadow(0 18px 22px rgba(80, 50, 40, 0.18))",
        }}
      >
        <Image
          src="/affiliate-mascots/yarnstash/cat_knitting.png"
          alt=""
          fill
          sizes="200px"
          style={{ objectFit: "contain" }}
          priority
        />
      </div>
      {/* Tiny yarn-ball companion bottom-right */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          right: "calc(50% - 240px)",
          bottom: "calc(50% - 220px)",
          width: 130,
          height: 130,
          transform: "rotate(8deg)",
          opacity: 0.9,
          pointerEvents: "none",
          filter: "drop-shadow(0 14px 20px rgba(80, 50, 40, 0.18))",
        }}
      >
        <Image
          src="/affiliate-mascots/yarnstash/cat_yarn_ball.png"
          alt=""
          fill
          sizes="130px"
          style={{ objectFit: "contain" }}
        />
      </div>

      <article
        style={{
          position: "relative",
          maxWidth: 420,
          width: "100%",
          background: T.paper,
          borderRadius: 2,
          padding: "44px 28px 30px",
          boxShadow:
            `0 0 0 1px ${T.hair},` +
            `0 2px 0 ${T.sand},` +
            `0 24px 60px -22px rgba(60, 30, 24, 0.28),` +
            `0 8px 18px -10px rgba(60, 30, 24, 0.18)`,
          transform: "rotate(-0.4deg)",
        }}
      >
        {/* Washi-tape strip across the top of the card. Slightly off-centre
            and tilted so it reads as placed, not generated. */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: -12,
            left: "42%",
            width: 120,
            height: 26,
            background: `repeating-linear-gradient(45deg, ${T.roseSoft} 0 6px, ${T.rose}33 6px 12px)`,
            border: `1px solid ${T.hair}`,
            transform: "translateX(-50%) rotate(-3.5deg)",
            opacity: 0.85,
            boxShadow: "0 2px 4px rgba(0,0,0,0.06)",
          }}
        />
        {/* Stitched border — dotted line just inside the paper edge, like a
            hand-bound notebook. */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 8,
            border: `1.5px dashed ${T.sandDeep}`,
            borderRadius: 1,
            pointerEvents: "none",
            opacity: 0.55,
          }}
        />

        {/* Eyebrow row: official app-icon (small, anchored left) + invite chip
            (right). Asymmetric, no centered icon-tile stack. */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 22,
          }}
        >
          <span
            style={{
              width: 44,
              height: 44,
              borderRadius: 11,
              overflow: "hidden",
              boxShadow: `0 6px 14px -4px ${T.rose}66, 0 0 0 1px ${T.hair}`,
              position: "relative",
              flexShrink: 0,
            }}
          >
            <Image
              src="/icons/yarnstash.webp"
              alt="My Yarn Stash icon"
              fill
              sizes="44px"
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
                padding: "4px 9px 4px 10px",
                background: T.roseSoft,
                color: T.roseInk,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1.6,
                textTransform: "uppercase",
                fontFamily: "var(--ys-display), Georgia, serif",
                border: `1px solid ${T.rose}33`,
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: 5, background: T.rose }} />
              Empf. · {code}
            </span>
          ) : (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: T.thread,
                fontFamily: "var(--ys-editorial), Georgia, serif",
                fontStyle: "italic",
              }}
            >
              No. 0 · Atelier
            </span>
          )}
        </header>

        {/* Headline. Left-aligned, italic accent on the editorial line, hard
            line-break for typographic rhythm. */}
        <h1
          style={{
            fontFamily: "var(--ys-display), 'Gloock', Georgia, serif",
            fontSize: 42,
            fontWeight: 400,
            margin: "0 0 6px",
            letterSpacing: -0.6,
            color: T.ink,
            lineHeight: 0.98,
          }}
        >
          My Yarn
          <br />
          Stash
          <span style={{ color: T.rose }}>.</span>
        </h1>
        <p
          style={{
            fontFamily: "var(--ys-editorial), 'Newsreader', Georgia, serif",
            fontStyle: "italic",
            fontSize: 18,
            color: T.rose,
            margin: "0 0 20px",
            letterSpacing: 0.1,
          }}
        >
          stash. match. knit.
        </p>

        <p
          style={{
            fontFamily: "var(--ys-editorial), 'Newsreader', Georgia, serif",
            fontSize: 15.5,
            color: T.ink,
            margin: "0 0 24px",
            lineHeight: 1.55,
            maxWidth: 34 * 9,
          }}
        >
          Dein Garn, deine Projekte, passende Anleitungen. Scan das Etikett,
          Vision-AI macht den Rest.
        </p>

        {/* Numbered features — list, not pills. Each feature reads like a
            line in a sewing pattern. */}
        <ol
          style={{
            listStyle: "none",
            padding: 0,
            margin: "0 0 28px",
            display: "grid",
            gap: 10,
            color: T.ink,
            fontSize: 13.5,
            fontFamily: "var(--ys-editorial), Georgia, serif",
          }}
        >
          {[
            ["01", "Ravelry-Match auf Knopfdruck"],
            ["02", "Wrapper-Scan via Kamera"],
            ["03", "Foto-first, kein Tippen"],
          ].map(([num, label]) => (
            <li
              key={num}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: 12,
                alignItems: "baseline",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--ys-display), Georgia, serif",
                  fontSize: 11,
                  fontWeight: 400,
                  color: T.rose,
                  letterSpacing: 1.8,
                }}
              >
                {num}
              </span>
              <span>{label}</span>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={onOpen}
          disabled={redirecting}
          style={{
            width: "100%",
            padding: "14px 22px",
            background: redirecting ? T.roseInk : T.rose,
            color: T.paper,
            border: `2px solid ${T.ink}`,
            borderRadius: 0,
            fontFamily: "var(--ys-display), 'Gloock', Georgia, serif",
            fontSize: 17,
            fontWeight: 400,
            letterSpacing: 0.4,
            cursor: redirecting ? "wait" : "pointer",
            transition: "transform 90ms ease, box-shadow 90ms ease",
            boxShadow: `4px 4px 0 ${T.ink}`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
          onMouseDown={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform =
              "translate(2px, 2px)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              `2px 2px 0 ${T.ink}`;
          }}
          onMouseUp={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "";
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              `4px 4px 0 ${T.ink}`;
          }}
        >
          <span>{redirecting ? "App Store…" : "Im App Store öffnen"}</span>
          <span
            aria-hidden
            style={{
              fontFamily: "var(--ys-editorial), Georgia, serif",
              fontStyle: "italic",
              fontSize: 16,
              opacity: 0.85,
            }}
          >
            →
          </span>
        </button>

        <p
          style={{
            fontSize: 11.5,
            color: T.mute,
            margin: "18px 0 0",
            lineHeight: 1.55,
            fontFamily: "var(--ys-editorial), Georgia, serif",
          }}
        >
          {code
            ? "Tippe öffnen, die Empfehlung wird der Installation automatisch zugeordnet."
            : "iPhone und iPad. Auch ohne Empfehlungscode."}
        </p>

        {/* Footer line — like a printed colophon at the bottom of a zine. */}
        <footer
          style={{
            marginTop: 28,
            paddingTop: 14,
            borderTop: `1px dashed ${T.sandDeep}`,
            display: "flex",
            justifyContent: "space-between",
            fontSize: 10,
            color: T.thread,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            fontFamily: "var(--ys-editorial), Georgia, serif",
            fontStyle: "italic",
          }}
        >
          <span>Atelier · iPhone &amp; iPad</span>
          <span>{code || "v1"}</span>
        </footer>
      </article>
    </main>
  );
}
