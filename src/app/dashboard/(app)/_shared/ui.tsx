// Reusable UI atoms for every dashboard sub-page. Co-located in _shared/
// so all 4 pages share the same Card + Row + button styles without each
// re-declaring 50 lines of inline style objects.

import Link from "next/link";

export function PageHeader({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string;
  title: React.ReactNode;
  intro?: string;
}) {
  return (
    <header style={{ marginBottom: 28 }}>
      <div
        style={{
          fontSize: 11,
          letterSpacing: 1.6,
          textTransform: "uppercase",
          color: "var(--fg-3)",
          marginBottom: 6,
          fontFamily: "var(--font-mono, monospace)",
        }}
      >
        {eyebrow}
      </div>
      <h1
        style={{
          fontFamily: "var(--font-display, system-ui)",
          fontSize: "clamp(28px, 4vw, 38px)",
          fontWeight: 600,
          letterSpacing: -0.8,
          margin: 0,
          color: "var(--fg)",
          lineHeight: 1.05,
        }}
      >
        {title}
      </h1>
      {intro && (
        <p style={{ fontSize: 14.5, color: "var(--fg-2)", margin: "10px 0 0", maxWidth: 640, lineHeight: 1.55 }}>
          {intro}
        </p>
      )}
    </header>
  );
}

export function Card({
  eyebrow,
  title,
  children,
  href,
}: {
  eyebrow?: string;
  title?: string;
  children: React.ReactNode;
  href?: string;
}) {
  const inner = (
    <article
      style={{
        background: "color-mix(in oklab, var(--fg), transparent 94%)",
        border: "1px solid color-mix(in oklab, var(--fg), transparent 82%)",
        borderRadius: 14,
        padding: "22px 22px 18px",
        display: "flex",
        flexDirection: "column",
        textDecoration: "none",
        color: "inherit",
        transition: "border-color 120ms ease, transform 120ms ease",
        cursor: href ? "pointer" : "default",
      }}
    >
      {eyebrow && (
        <div
          style={{
            fontSize: 10.5,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: "var(--fg-3)",
            marginBottom: 6,
            fontFamily: "var(--font-mono, monospace)",
          }}
        >
          {eyebrow}
        </div>
      )}
      {title && (
        <h2
          style={{
            fontFamily: "var(--font-display, system-ui)",
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: -0.3,
            margin: "0 0 14px",
            color: "var(--fg)",
          }}
        >
          {title}
        </h2>
      )}
      {children}
    </article>
  );
  if (href) {
    return (
      <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
        {inner}
      </Link>
    );
  }
  return inner;
}

export function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "6px 0",
        borderBottom: "1px dashed color-mix(in oklab, var(--fg), transparent 86%)",
      }}
    >
      <span style={{ fontSize: 13, color: "var(--fg-2)" }}>{label}</span>
      <span
        style={{
          fontFamily: "var(--font-mono, monospace)",
          fontSize: accent ? 20 : 14,
          color: accent ? "var(--fg)" : "var(--fg-2)",
          fontWeight: accent ? 600 : 400,
        }}
      >
        {value}
      </span>
    </div>
  );
}

export const primaryButton: React.CSSProperties = {
  display: "block",
  textAlign: "center",
  padding: "11px 18px",
  background: "var(--fg)",
  color: "var(--bg)",
  borderRadius: 10,
  textDecoration: "none",
  fontWeight: 600,
  fontSize: 14,
  marginBottom: 8,
};

export const secondaryButton: React.CSSProperties = {
  display: "block",
  textAlign: "center",
  padding: "10px 18px",
  background: "transparent",
  color: "var(--fg)",
  border: "1px solid color-mix(in oklab, var(--fg), transparent 70%)",
  borderRadius: 10,
  textDecoration: "none",
  fontWeight: 500,
  fontSize: 13.5,
  marginBottom: 8,
};

export const pillLink: React.CSSProperties = {
  display: "block",
  padding: "8px 12px",
  background: "color-mix(in oklab, var(--fg), transparent 92%)",
  border: "1px solid color-mix(in oklab, var(--fg), transparent 80%)",
  borderRadius: 8,
  fontSize: 13,
  color: "var(--fg)",
  textDecoration: "none",
  fontWeight: 500,
};

export function AppBadges({
  apps,
  handles,
}: {
  apps: string[];
  handles: Record<string, string>;
}) {
  const APP_NAME: Record<string, string> = {
    wavelength: "Wavelength",
    kelva: "Kelva",
    trubel: "Trubel",
    myloo: "MyLoo",
    "yarn-stash": "Yarn-Stash",
    moto: "ThrottleUp",
  };
  const APP_ICON: Record<string, string> = {
    wavelength: "/icons/wavelength.webp",
    kelva: "/icons/kelva.webp",
    trubel: "/icons/trubel.webp",
    myloo: "/icons/myloo.webp",
    "yarn-stash": "/icons/yarnstash.webp",
    moto: "/icons/moto.webp",
  };
  if (apps.length === 0) {
    return <span style={{ fontSize: 14, color: "var(--fg-3)" }}>Not connected to any app yet.</span>;
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {apps.map((slug) => {
        const name = APP_NAME[slug] ?? slug;
        const icon = APP_ICON[slug];
        const handle = handles[slug];
        return (
          <span
            key={slug}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 10px 5px 5px",
              background: "color-mix(in oklab, var(--fg), transparent 92%)",
              border: "1px solid color-mix(in oklab, var(--fg), transparent 80%)",
              borderRadius: 999,
              fontSize: 13,
              color: "var(--fg)",
            }}
          >
            {icon && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={icon} alt="" width={22} height={22} style={{ borderRadius: 6 }} />
            )}
            <b style={{ fontWeight: 600 }}>{name}</b>
            {handle && (
              <span
                style={{
                  color: "var(--fg-3)",
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 12,
                }}
              >
                @{handle}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
