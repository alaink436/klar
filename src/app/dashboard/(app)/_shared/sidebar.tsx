"use client";

// Sidebar nav for the (app) layout. Client component so it can read the
// active pathname via next/navigation and highlight the matching nav item.
// Receives the signed-in user's email as a prop because the parent layout
// is a server component and can't pass usePathname through to a child.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KlarWordmark } from "../../_shared/auth-shell";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const ICON_GRID = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);
const ICON_COIN = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 6v12M9 9.5h4.5a2 2 0 0 1 0 4H9.5a2 2 0 0 0 0 4H15" />
  </svg>
);
const ICON_FUNNEL = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 5h18l-7 8v6l-4 2v-8L3 5z" />
  </svg>
);
const ICON_USER = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
  </svg>
);
const ICON_CHAT = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5.6A8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
  </svg>
);

const NAV: NavItem[] = [
  { href: "/dashboard",          label: "Overview", icon: ICON_GRID },
  { href: "/dashboard/earnings", label: "Earnings", icon: ICON_COIN },
  { href: "/dashboard/funnel",   label: "Funnel",   icon: ICON_FUNNEL },
  { href: "/dashboard/chat",     label: "Chat",     icon: ICON_CHAT },
  { href: "/dashboard/account",  label: "Account",  icon: ICON_USER },
];

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname() ?? "";

  return (
    <aside
      style={{
        padding: "24px 18px 18px",
        borderRight: "1px solid color-mix(in oklab, var(--fg), transparent 86%)",
        background: "color-mix(in oklab, var(--fg), transparent 96%)",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        position: "sticky",
        top: 0,
        height: "100dvh",
      }}
    >
      <div style={{ paddingLeft: 4 }}>
        <KlarWordmark />
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: "var(--fg-4)",
            fontFamily: "var(--font-mono, monospace)",
            padding: "10px 10px 4px",
          }}
        >
          Dashboard
        </div>
        {NAV.map((n) => {
          // "/dashboard" matches only the root. Sub-paths match by prefix
          // (but not the root) so /dashboard/earnings/anything still
          // highlights "Earnings".
          const isActive =
            n.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname === n.href || pathname.startsWith(n.href + "/");
          return (
            <Link
              key={n.href}
              href={n.href}
              prefetch
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "var(--fg)" : "var(--fg-2)",
                background: isActive
                  ? "color-mix(in oklab, var(--fg), transparent 86%)"
                  : "transparent",
                textDecoration: "none",
                transition: "background 120ms ease, color 120ms ease",
                borderLeft: isActive
                  ? "2px solid var(--fg)"
                  : "2px solid transparent",
              }}
            >
              <span style={{ display: "inline-flex", color: isActive ? "var(--fg)" : "var(--fg-3)" }}>
                {n.icon}
              </span>
              {n.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
        <div
          style={{
            fontSize: 11,
            color: "var(--fg-3)",
            padding: "10px 12px",
            borderTop: "1px solid color-mix(in oklab, var(--fg), transparent 90%)",
          }}
        >
          <div
            style={{
              color: "var(--fg-4)",
              fontSize: 10,
              letterSpacing: 1,
              textTransform: "uppercase",
              fontFamily: "var(--font-mono, monospace)",
            }}
          >
            Signed in as
          </div>
          <div style={{ marginTop: 4, color: "var(--fg-2)", wordBreak: "break-all" }}>
            {email}
          </div>
        </div>
        <form action="/dashboard/logout" method="POST">
          <button
            type="submit"
            style={{
              width: "100%",
              padding: "9px 12px",
              background: "transparent",
              color: "var(--fg-2)",
              border: "1px solid color-mix(in oklab, var(--fg), transparent 82%)",
              borderRadius: 8,
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "inherit",
              textAlign: "left",
            }}
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
