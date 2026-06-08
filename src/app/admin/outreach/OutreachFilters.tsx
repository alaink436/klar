// Outreach filter strip, on shadcn-styled primitives. Pure navigation: every
// control is a plain <a> link or a GET <form> (no client state), so it cannot
// affect the mail/scrape pipeline. Hrefs mirror buildFilterHref in page.tsx.

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface OutreachFilterState {
  platform: string;
  status: string;
  app: string;
  q: string;
  autoRefresh: boolean;
  showTests: boolean;
  statusOptions: { value: string; label: string }[];
  appOptions: string[];
  size: string;
  sizeOptions: { value: string; label: string; range: string }[];
}

function Seg({ items }: { items: { href: string; label: string; on: boolean }[] }) {
  return (
    <div className="inline-flex flex-wrap rounded-[var(--radius-sm)] border border-line-strong overflow-hidden bg-surface">
      {items.map((it, i) => (
        <a
          key={i}
          href={it.href}
          className={`px-3.5 py-1.5 [font-family:var(--font-mono)] text-[11px] font-semibold tracking-[0.08em] uppercase border-r border-line last:border-r-0 transition-colors ${
            it.on ? "bg-fg text-accent-fg" : "text-fg-3 hover:bg-surface-2 hover:text-fg-2"
          }`}
        >
          {it.label}
        </a>
      ))}
    </div>
  );
}

export default function OutreachFilters({
  platform,
  status,
  app,
  q,
  autoRefresh,
  showTests,
  statusOptions,
  appOptions,
  size,
  sizeOptions,
}: OutreachFilterState) {
  const build = (p: string, s: string, a: string, opts?: { ar?: boolean; tests?: boolean; dropQ?: boolean; sz?: string }) => {
    const ar = opts?.ar ?? autoRefresh;
    const tests = opts?.tests ?? showTests;
    const sz = opts?.sz ?? size;
    const parts = ["view=outreach"];
    if (p !== "all") parts.push(`p=${encodeURIComponent(p)}`);
    if (s !== "all") parts.push(`s=${encodeURIComponent(s)}`);
    if (a !== "all") parts.push(`a=${encodeURIComponent(a)}`);
    if (sz !== "all") parts.push(`sz=${encodeURIComponent(sz)}`);
    if (q && !opts?.dropQ) parts.push(`q=${encodeURIComponent(q)}`);
    if (ar) parts.push("ar=1");
    if (tests) parts.push("show_tests=1");
    return `/admin?${parts.join("&")}`;
  };

  return (
    <section className="mb-5">
      <div className="[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.16em] text-fg-3 mb-3 flex items-center gap-2.5 after:content-[''] after:flex-1 after:h-px after:bg-line">
        Filter
      </div>

      <div className="flex flex-wrap gap-2.5 items-center mb-3.5">
        <form method="GET" action="/admin" className="flex gap-2 items-center flex-1 max-w-[480px]">
          <input type="hidden" name="view" value="outreach" />
          {platform !== "all" && <input type="hidden" name="p" value={platform} />}
          {status !== "all" && <input type="hidden" name="s" value={status} />}
          {app !== "all" && <input type="hidden" name="a" value={app} />}
          {size !== "all" && <input type="hidden" name="sz" value={size} />}
          {autoRefresh && <input type="hidden" name="ar" value="1" />}
          {showTests && <input type="hidden" name="show_tests" value="1" />}
          <Input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Suche handle / display name / niche / notes…"
            maxLength={80}
            className="flex-1 py-2"
          />
          <Button type="submit" variant="ghost" size="sm">
            Suchen
          </Button>
          {q && (
            <Button asChild variant="ghost" size="sm">
              <a href={build(platform, status, app, { dropQ: true })} aria-label="Suche zurücksetzen">
                ×
              </a>
            </Button>
          )}
        </form>

        <div className="ml-auto">
          <Seg
            items={[
              { href: build(platform, status, app, { ar: true }), label: "15s ⟲", on: autoRefresh },
              { href: build(platform, status, app, { ar: false }), label: "Pause", on: !autoRefresh },
            ]}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2.5 mb-3">
        <Seg
          items={[
            { href: build("all", status, app), label: "Alle", on: platform === "all" },
            { href: build("tiktok", status, app), label: "TikTok", on: platform === "tiktok" },
            { href: build("instagram", status, app), label: "Instagram", on: platform === "instagram" },
          ]}
        />
        <Seg
          items={[
            { href: build(platform, "all", app), label: "Alle", on: status === "all" },
            ...statusOptions.map((o) => ({ href: build(platform, o.value, app), label: o.label, on: status === o.value })),
          ]}
        />
      </div>

      <Seg
        items={appOptions.map((a) => ({
          href: build(platform, status, a),
          label: a === "all" ? "Alle Apps" : a,
          on: app === a,
        }))}
      />

      <div className="mt-3">
        <Seg
          items={[
            { href: build(platform, status, app, { sz: "all" }), label: "Alle Größen", on: size === "all" },
            ...sizeOptions.map((o) => ({
              href: build(platform, status, app, { sz: o.value }),
              label: `${o.label} · ${o.range}`,
              on: size === o.value,
            })),
          ]}
        />
      </div>
    </section>
  );
}
