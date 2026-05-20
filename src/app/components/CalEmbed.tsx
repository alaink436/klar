// Lightweight Cal.com inline embed. Iframe-only (no extra runtime dep, no
// Cal embed-react script). Pass the cal.getklar.org event-type slug, e.g.
// "consulting" or "coaching". Renders behind a <details> so it doesn't
// dominate the page until a visitor opts in.

interface CalEmbedProps {
  slug: string;
  label?: string;
  // Cal custom domain. cal.getklar.org is the production default.
  host?: string;
  height?: number;
}

export default function CalEmbed({
  slug,
  label = "Lieber direkt einen Slot picken",
  host = "https://cal.getklar.org",
  height = 720,
}: CalEmbedProps) {
  const src = `${host}/${slug}?embed=true`;
  return (
    <details className="mt-5 group">
      <summary
        style={{
          cursor: "pointer",
          listStyle: "none",
          padding: "10px 14px",
          border: "1px solid var(--line, #2a2a2a)",
          borderRadius: 8,
          fontFamily: "var(--font-mono, ui-monospace), monospace",
          fontSize: 12,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          color: "var(--fg-2, #d4d4d4)",
        }}
      >
        <span>{label}</span>
        <span style={{ fontFamily: "inherit", fontSize: 14 }}>↓</span>
      </summary>
      <div
        style={{
          marginTop: 10,
          border: "1px solid var(--line, #2a2a2a)",
          borderRadius: 8,
          overflow: "hidden",
          background: "var(--bg-2, #0d0d0d)",
        }}
      >
        <iframe
          src={src}
          title={`Buchung · ${slug}`}
          width="100%"
          height={height}
          loading="lazy"
          style={{ display: "block", border: 0, width: "100%", height }}
          allow="payment"
        />
      </div>
    </details>
  );
}
