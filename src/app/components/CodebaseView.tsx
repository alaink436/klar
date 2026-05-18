/**
 * Studio-wide "codebase, by the numbers". Real figures scanned from the
 * actual app repos at build time (src/app/data/codebase.json), not
 * marketing claims, not a flaky API. Per-app depth lives in each app
 * modal; this is the aggregate proof.
 */
import codebase from "../data/codebase.json";

const PROFILE = "https://github.com/alaink436";

interface AppMetric {
  files: number;
  lines: number;
  commits: number | null;
  avg_per_file: number;
}

const fmt = (n: number) => n.toLocaleString("en-US");

const NAMES: Record<string, string> = {
  trubel: "trubel",
  myloo: "myloo",
  wavelength: "wavelength",
  "yarn-stash": "yarn-stash",
  kelva: "kelva",
  moto: "moto",
};

export default function CodebaseView() {
  const t = codebase.totals;
  const apps = codebase.apps as Record<string, AppMetric>;
  const rows = Object.entries(apps).sort((a, b) => b[1].lines - a[1].lines);

  const stats: [string, string, string][] = [
    [fmt(t.lines), "lines of code", "shipped, not slideware"],
    [String(t.apps), "real apps", "0 → 1, solo"],
    [fmt(t.files), "source files", "typed end to end"],
    [fmt(t.commits), "commits", "build / ship / loop"],
  ];

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 border-t border-l border-[var(--line-strong)] mb-8 sm:mb-10">
        {stats.map(([v, k, s]) => (
          <div
            key={k}
            className="border-b border-r border-[var(--line-strong)] p-4 sm:p-5"
          >
            <p className="display text-3xl sm:text-4xl md:text-5xl">{v}</p>
            <p className="label-fg mt-2">{k}</p>
            <p className="label mt-1">{s}</p>
          </div>
        ))}
      </div>

      <p className="label mb-3">per app · scanned from the repos</p>
      <div className="border-t border-[var(--line-strong)]">
        {rows.map(([slug, m]) => {
          const max = rows[0][1].lines || 1;
          return (
            <div
              key={slug}
              className="border-b border-[var(--line)] py-3 sm:py-4 grid grid-cols-12 gap-2 sm:gap-4 items-center"
            >
              <span className="col-span-3 sm:col-span-2 display text-base sm:text-lg">
                {NAMES[slug] ?? slug}
              </span>
              <span className="col-span-5 sm:col-span-6 h-2 bg-[var(--bg-2)] relative">
                <span
                  className="absolute inset-y-0 left-0 bg-[var(--fg)]"
                  style={{ width: `${Math.round((m.lines / max) * 100)}%` }}
                />
              </span>
              <span className="col-span-2 label text-right tabular-nums">
                {fmt(m.lines)}
              </span>
              <span className="col-span-2 label text-right hidden sm:block">
                {m.commits ?? "—"} commits
              </span>
            </div>
          );
        })}
      </div>

      <p className="t-body-lg text-[var(--fg-3)] mt-6 max-w-2xl">
        Open any app above for its own codebase x-ray. Numbers regenerated
        from the working trees, not estimated.
      </p>
      <a
        href={PROFILE}
        target="_blank"
        rel="noopener"
        className="label-fg brut-line-thin px-3 py-1.5 inline-block mt-5 hover:bg-[var(--fg)] hover:text-[var(--bg)] transition"
      >
        github.com/alaink436 ↗
      </a>
    </div>
  );
}
