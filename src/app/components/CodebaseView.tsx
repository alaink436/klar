/**
 * Server component: "the codebase, by the numbers". One GitHub user call
 * + one repos call, aggregated, ISR-cached hourly (no auth, no secret,
 * stays under the unauthenticated rate limit). Degrades to a static
 * fallback so the page never breaks if GitHub is unreachable.
 */
const USER = "alaink436";
const PROFILE = `https://github.com/${USER}`;

interface Repo {
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  pushed_at: string;
  html_url: string;
  fork: boolean;
  private: boolean;
}

function ago(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (d < 1) return "today";
  if (d < 2) return "yesterday";
  if (d < 31) return `${Math.floor(d)}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

async function getData() {
  const opts = {
    headers: { Accept: "application/vnd.github+json" },
    next: { revalidate: 3600 },
  } as const;
  const [uRes, rRes] = await Promise.all([
    fetch(`https://api.github.com/users/${USER}`, opts),
    fetch(
      `https://api.github.com/users/${USER}/repos?per_page=100&sort=pushed`,
      opts,
    ),
  ]);
  if (!uRes.ok || !rRes.ok) return null;
  const u = await uRes.json();
  const repos = (await rRes.json()) as Repo[];
  if (!Array.isArray(repos)) return null;

  const own = repos.filter((r) => !r.fork);
  const langs = new Map<string, number>();
  let stars = 0;
  for (const r of own) {
    stars += r.stargazers_count || 0;
    if (r.language) langs.set(r.language, (langs.get(r.language) ?? 0) + 1);
  }
  const langTop = [...langs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const recent = [...own]
    .sort((a, b) => +new Date(b.pushed_at) - +new Date(a.pushed_at))
    .slice(0, 6);
  const years = u?.created_at
    ? Math.max(
        1,
        Math.round(
          (Date.now() - new Date(u.created_at).getTime()) / 31557600000,
        ),
      )
    : null;

  return {
    publicRepos: Number(u?.public_repos ?? own.length),
    ownCount: own.length,
    stars,
    langTop,
    langCount: langs.size,
    recent,
    years,
  };
}

export default async function CodebaseView() {
  let data: Awaited<ReturnType<typeof getData>> = null;
  try {
    data = await getData();
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <div className="max-w-3xl">
        <p className="t-body-lg text-[var(--fg-2)] mb-5">
          Everything here is built and shipped in public.
        </p>
        <a
          href={PROFILE}
          target="_blank"
          rel="noopener"
          className="label-fg brut-line-thin px-3 py-1.5 inline-block hover:bg-[var(--fg)] hover:text-[var(--bg)] transition"
        >
          github.com/{USER} ↗
        </a>
      </div>
    );
  }

  const { publicRepos, stars, langTop, langCount, recent, years } = data;
  const maxLang = Math.max(...langTop.map(([, n]) => n), 1);

  const stats: [string, string, string][] = [
    [String(publicRepos), "public repos", "and counting"],
    [String(langCount), "languages", "shipped with"],
    [years ? `${years}y` : "—", "on github", "building in public"],
    [stars > 0 ? `★ ${stars}` : "solo", stars > 0 ? "stars" : "studio", "one person, ai in the loop"],
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

      <p className="label mb-3">most used</p>
      <div className="space-y-2 mb-8 sm:mb-10 max-w-2xl">
        {langTop.map(([lang, n]) => (
          <div key={lang} className="flex items-center gap-3">
            <span className="label-fg w-28 sm:w-36 shrink-0">{lang}</span>
            <span className="flex-1 h-2 bg-[var(--bg-2)] relative">
              <span
                className="absolute inset-y-0 left-0 bg-[var(--fg)]"
                style={{ width: `${Math.round((n / maxLang) * 100)}%` }}
              />
            </span>
            <span className="label w-8 text-right shrink-0">{n}</span>
          </div>
        ))}
      </div>

      <p className="label mb-3">latest pushes</p>
      <div className="border-t border-[var(--line-strong)]">
        {recent.map((r) => (
          <a
            key={r.name}
            href={r.html_url}
            target="_blank"
            rel="noopener"
            className="border-b border-[var(--line)] py-3 sm:py-4 grid grid-cols-12 gap-2 sm:gap-4 items-center group"
          >
            <span className="col-span-12 sm:col-span-3 display text-base sm:text-lg group-hover:text-[var(--silver)] transition">
              {r.name}
            </span>
            <span className="col-span-8 sm:col-span-6 t-body-lg text-[var(--fg-3)] text-sm truncate">
              {r.description || "—"}
            </span>
            <span className="col-span-2 sm:col-span-2 label text-right sm:text-left">
              {r.language || "—"}
            </span>
            <span className="col-span-2 sm:col-span-1 label text-right">
              {ago(r.pushed_at)}
            </span>
          </a>
        ))}
      </div>

      <a
        href={PROFILE}
        target="_blank"
        rel="noopener"
        className="label-fg brut-line-thin px-3 py-1.5 inline-block mt-6 hover:bg-[var(--fg)] hover:text-[var(--bg)] transition"
      >
        full profile · github.com/{USER} ↗
      </a>
    </div>
  );
}
