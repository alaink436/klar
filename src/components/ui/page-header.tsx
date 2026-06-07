// Dashboard page header: an eyebrow label, the big display title (Bebas Neue via
// --font-display) and an optional editorial subtitle, inside a surface card. A
// nicer, more "control-panel" title than a bare <h1>. Drop in at the top of an
// admin page's .content.

import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-7 rounded-[var(--radius-lg)] border border-line bg-surface px-7 py-7 shadow-[var(--shadow-sm)]">
      {eyebrow ? (
        <div className="mb-2 [font-family:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[0.24em] text-fg-4">
          {eyebrow}
        </div>
      ) : null}
      <h1 className="m-0 [font-family:var(--font-display)] text-[clamp(36px,5vw,58px)] font-normal leading-[0.92] tracking-[0.015em] text-fg">
        {title}
      </h1>
      {children ? (
        <p className="mt-3 max-w-[64ch] [font-family:var(--font-editorial)] text-[15px] italic leading-relaxed text-fg-3">
          {children}
        </p>
      ) : null}
    </div>
  );
}
