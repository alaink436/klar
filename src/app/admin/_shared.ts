// Shared admin helpers: HTML escaping, a relative-time label, the font link
// and the theme init script. The design itself lives in admin.css, which
// admin/layout.tsx imports; the token page in tokens/route.ts renders its own
// HTML and inlines that file. The admin check lives in lib/adminSession
// (adapters in lib/adminGuard).

export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Relative-time label (de): heute / gestern / vor Nd / vor Nmo / vor Ny.
// Used by the content page and lib/collabView.
export function fmtRelative(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days < 1) return "heute";
  if (days < 2) return "gestern";
  if (days < 30) return `vor ${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `vor ${months}mo`;
  return `vor ${Math.floor(months / 12)}y`;
}

// Only for the token page in tokens/route.ts, which renders its own HTML. The
// React pages get the same families from next/font in admin/layout.tsx.
export const FONTS_LINK =
  `https://fonts.googleapis.com/css2?family=Geist:wght@300..700&family=Geist+Mono:wght@400..600&display=swap`;

// Klar Control is dark only. The attribute still matters: Tailwind's `dark:`
// variant (Tremor charts) is mapped onto it in globals.css. Inline, so it is
// set before the first paint.
export const THEME_INIT_SCRIPT = `document.documentElement.dataset.theme="dark"`;
