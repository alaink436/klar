"use client";

// Compact card layout for the 4 auth screens (signup / login / magic /
// cancel). Kept as a single shared component so the screens stay visually
// identical and only the form body changes. The KLAR wordmark sits above
// the card as a small, restrained brand anchor.

import Link from "next/link";

export function AuthShell({
  eyebrow,
  title,
  intro,
  children,
  footer,
}: {
  eyebrow: string;
  title: React.ReactNode;
  intro: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 18px",
        gap: 24,
      }}
    >
      <KlarWordmark />
      <article
        style={{
          width: "100%",
          maxWidth: 440,
          background: "color-mix(in oklab, var(--fg), transparent 92%)",
          border: "1px solid color-mix(in oklab, var(--fg), transparent 78%)",
          borderRadius: 18,
          padding: "32px 28px",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: "var(--fg-3)",
            marginBottom: 10,
            fontFamily: "var(--font-mono, ui-monospace, monospace)",
          }}
        >
          {eyebrow}
        </div>
        <h1
          style={{
            fontFamily: "var(--font-display, system-ui, sans-serif)",
            fontWeight: 600,
            fontSize: "clamp(28px, 5.5vw, 36px)",
            letterSpacing: -0.6,
            lineHeight: 1.05,
            margin: 0,
            color: "var(--fg)",
          }}
        >
          {title}
        </h1>
        <p
          style={{
            fontSize: 14.5,
            lineHeight: 1.55,
            color: "var(--fg-2)",
            margin: "14px 0 22px",
          }}
        >
          {intro}
        </p>

        {children}

        {footer ? (
          <div
            style={{
              marginTop: 22,
              paddingTop: 16,
              borderTop: "1px solid color-mix(in oklab, var(--fg), transparent 86%)",
              fontSize: 13,
              color: "var(--fg-3)",
              textAlign: "center",
            }}
          >
            {footer}
          </div>
        ) : null}

        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 11.5,
            color: "var(--fg-4)",
            letterSpacing: 0.4,
          }}
        >
          <Link href="/" style={{ color: "var(--fg-3)", textDecoration: "none" }}>
            ← getklar.org
          </Link>
        </div>
      </article>
    </div>
  );
}

// Klar wordmark used on auth + cancel screens. Pure typography, no PNG,
// so it stays sharp at any zoom level and avoids loading an extra image.
export function KlarWordmark({ size = "md" }: { size?: "sm" | "md" }) {
  const fontSize = size === "sm" ? 18 : 24;
  return (
    <Link
      href="/"
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 6,
        textDecoration: "none",
        color: "var(--fg)",
        letterSpacing: -0.4,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-display, system-ui, sans-serif)",
          fontWeight: 600,
          fontSize,
          color: "var(--fg)",
        }}
      >
        Klar
      </span>
      <span
        style={{
          fontFamily: "var(--font-editorial, Georgia, serif)",
          fontStyle: "italic",
          fontWeight: 400,
          fontSize: fontSize * 0.7,
          color: "var(--fg-3)",
        }}
      >
        affiliate
      </span>
    </Link>
  );
}

export const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  background: "color-mix(in oklab, var(--fg), transparent 94%)",
  border: "1px solid color-mix(in oklab, var(--fg), transparent 78%)",
  borderRadius: 10,
  fontSize: 15,
  color: "var(--fg)",
  fontFamily: "inherit",
  outline: "none",
};

export const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  color: "var(--fg-2)",
  marginBottom: 6,
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
};

export const buttonStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px 22px",
  background: "var(--fg)",
  color: "var(--bg)",
  border: "none",
  borderRadius: 10,
  fontSize: 15,
  fontWeight: 700,
  fontFamily: "inherit",
  cursor: "pointer",
  letterSpacing: 0.2,
  transition: "opacity 120ms ease",
};

export const errorStyle: React.CSSProperties = {
  marginTop: 12,
  padding: "10px 12px",
  background: "color-mix(in oklab, #ff4444, transparent 86%)",
  border: "1px solid color-mix(in oklab, #ff4444, transparent 72%)",
  borderRadius: 8,
  fontSize: 13,
  color: "var(--fg)",
  lineHeight: 1.45,
};

export const successStyle: React.CSSProperties = {
  marginTop: 12,
  padding: "10px 12px",
  background: "color-mix(in oklab, #22c55e, transparent 86%)",
  border: "1px solid color-mix(in oklab, #22c55e, transparent 72%)",
  borderRadius: 8,
  fontSize: 13,
  color: "var(--fg)",
  lineHeight: 1.45,
};
