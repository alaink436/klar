import Image from "next/image";
import Link from "next/link";

type Status = "LIVE" | "COMING SOON" | "IN ENTWICKLUNG";

interface App {
  slug: string;
  name: string;
  pitch: string;
  longPitch: string;
  status: Status;
  storeUrl?: string;
  icon: string;
}

const APPS: App[] = [
  {
    slug: "trubel",
    name: "Trubel",
    pitch: "Drop a pin. Fill it with photos.",
    longPitch:
      "Geo-getaggte Foto-Alben mit Zeitfenster, geteilt per QR-Code. Beim Trigger-Zeitpunkt scannt die App deine Camera Roll und schlägt automatisch passende Fotos vor. Alle Alben landen als Pins auf einer Welt-Karte.",
    status: "IN ENTWICKLUNG",
    icon: "/icons/trubel.png",
  },
  {
    slug: "myloo",
    name: "MyLoo",
    pitch: "Tracking. Without the gross.",
    longPitch:
      "Verdauungs-Tracking mit Foto + Vision-AI nach Bristol-Stuhl-Skala. Für Menschen mit IBS, Crohn, Colitis und Eltern, die ihre Gesundheit im Griff haben wollen — ohne Friction.",
    status: "IN ENTWICKLUNG",
    icon: "/icons/myloo.png",
  },
  {
    slug: "wavelength",
    name: "Wavelength",
    pitch: "Plan smarter, together.",
    longPitch:
      "Persönlicher Kalender + Voting-Tool für Friends- und Sport-Groups. Heatmap-Abstimmung, Vision-OCR für Aushänge, sport-spezifische Lineups. Der Gruppen-Plan, der nicht nervt.",
    status: "IN ENTWICKLUNG",
    icon: "/icons/wavelength.png",
  },
  {
    slug: "yarn-stash",
    name: "Yarn-Stash",
    pitch: "Stash. Match. Knit.",
    longPitch:
      "Garn-Inventar, Pattern-Matching via Ravelry und Projekt-Tracker für Stricker:innen und Häkler:innen. Banderole scannen, Vision-AI extrahiert alles automatisch. Nimmt dir die Arbeit ab, die Ravelry vergessen hat.",
    status: "LIVE",
    storeUrl: "https://apps.apple.com/app/yarn-stash",
    icon: "/icons/yarnstash.png",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--fg)] selection:bg-[var(--accent)]">
      {/* ─────────── TOP MARQUEE ─────────── */}
      <div className="border-b border-[var(--line-strong)] overflow-hidden">
        <div className="flex marquee whitespace-nowrap py-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              className="label-fg px-6 shrink-0 flex items-center gap-6"
            >
              KLAR <span className="text-[var(--accent)]">✦</span> STUDIO FOR
              THE GENERATION SCROLL <span className="text-[var(--accent)]">✦</span>{" "}
              FOUR APPS, ONE SIGNAL <span className="text-[var(--accent)]">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* ─────────── NAV ─────────── */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-6 border-b border-[var(--line-strong)]">
        <div className="flex items-center gap-3">
          <span className="display text-2xl tracking-tighter">klar</span>
          <span className="label">// est. 2026</span>
        </div>
        <div className="flex items-center gap-6 md:gap-10">
          <Link href="#apps" className="label hover:text-[var(--fg)] transition">
            Apps
          </Link>
          <Link href="#manifesto" className="label hidden sm:block hover:text-[var(--fg)] transition">
            Manifesto
          </Link>
          <Link
            href="https://www.tiktok.com/@klar"
            target="_blank"
            className="label-fg flex items-center gap-2 group"
          >
            <span className="text-[var(--accent)] group-hover:text-[var(--accent-3)] transition">●</span>
            @klar
          </Link>
        </div>
      </nav>

      {/* ─────────── HERO ─────────── */}
      <section className="px-6 md:px-12 pt-16 md:pt-28 pb-12 md:pb-20 border-b border-[var(--line-strong)]">
        <div className="grid grid-cols-12 gap-y-8 md:gap-y-12">
          <div className="col-span-12 md:col-span-7">
            <p className="label mb-6">001 // INDIE STUDIO // SWITZERLAND</p>
            <h1 className="display text-[20vw] md:text-[16vw] leading-[0.82]">
              klar<span className="text-[var(--accent)]">.</span>
            </h1>
          </div>
          <div className="col-span-12 md:col-span-5 md:pl-8 md:border-l md:border-[var(--line-strong)] flex flex-col justify-end">
            <p className="editorial text-3xl md:text-5xl leading-[1.05] mb-8">
              Wir bauen Apps,<br />
              die nicht <span className="text-[var(--accent)]">langweilen</span>.
            </p>
            <p className="text-[var(--fg-2)] text-base md:text-lg max-w-md leading-relaxed">
              Vier Apps. Eine Crew. Gemacht für die Leute, die zwischen TikTok-Loops und echtem Leben pendeln.
            </p>
          </div>
        </div>
      </section>

      {/* ─────────── CREST ─────────── */}
      <section className="px-4 md:px-12 py-16 md:py-28 border-b border-[var(--line-strong)] relative">
        <div className="text-center mb-12 md:mb-20">
          <p className="label mb-4">002 // THE CREST</p>
          <h2 className="editorial text-4xl md:text-6xl">
            Vier Charaktere. Eine Familie.
          </h2>
        </div>

        {/* Crest grid: 2x2 icons + central logo */}
        <div className="relative mx-auto max-w-3xl aspect-square">
          {/* central glow ring */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="w-1/2 h-1/2 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, oklch(0.72 0.32 348 / 0.18) 0%, transparent 70%)",
              }}
            />
          </div>

          {/* 2x2 grid */}
          <div className="grid grid-cols-2 gap-6 md:gap-12 relative z-10">
            {APPS.map((app) => (
              <Link
                key={app.slug}
                href={`#${app.slug}`}
                className="icon-card group flex flex-col items-center"
              >
                <div className="relative w-full aspect-square">
                  <Image
                    src={app.icon}
                    alt={app.name}
                    fill
                    sizes="(max-width: 768px) 40vw, 240px"
                    className="object-contain"
                    priority
                  />
                </div>
                <div className="mt-3 md:mt-4 flex flex-col items-center gap-1">
                  <span className="display text-xl md:text-2xl">{app.name}</span>
                  <span
                    className={`label ${
                      app.status === "LIVE"
                        ? "text-[var(--accent-3)]"
                        : "text-[var(--accent)]"
                    }`}
                  >
                    {app.status === "LIVE" && "● "}
                    {app.status}
                  </span>
                  {app.storeUrl ? (
                    <Link
                      href={app.storeUrl}
                      target="_blank"
                      className="label hover:text-[var(--fg)] transition mt-0.5"
                    >
                      App Store ↗
                    </Link>
                  ) : (
                    <span className="label opacity-50 mt-0.5">— soon —</span>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {/* central chrome logo overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-[26%] aspect-square logo-glow">
              <Image
                src="/logo/klar-symbol.png"
                alt="Klar"
                fill
                sizes="(max-width: 768px) 25vw, 200px"
                className="object-contain"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── MANIFESTO ─────────── */}
      <section id="manifesto" className="px-6 md:px-12 py-20 md:py-32 border-b border-[var(--line-strong)]">
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 md:col-span-2">
            <p className="label">003 // MANIFESTO</p>
          </div>
          <div className="col-span-12 md:col-span-10">
            <p className="editorial text-3xl md:text-6xl leading-[1.08]">
              Klar ist ein Studio für Apps, die du nicht vergisst.
              Keine Newsletter, keine Onboarding-Slides ohne Sinn,
              kein Dark-Pattern-Theater. Wir bauen für{" "}
              <span className="text-[var(--accent)]">Gen-Z</span>,{" "}
              für <span className="text-[var(--accent-2)]">Strick-Nerds</span>,{" "}
              für{" "}
              <span className="text-[var(--accent-3)]">
                jeden, der was Echtes will
              </span>
              .
            </p>
          </div>
        </div>
      </section>

      {/* ─────────── APPS DETAIL ─────────── */}
      <section id="apps" className="px-6 md:px-12 py-16 md:py-24 border-b border-[var(--line-strong)]">
        <div className="grid grid-cols-12 gap-8 mb-12">
          <div className="col-span-12 md:col-span-2">
            <p className="label">004 // APPS</p>
          </div>
          <div className="col-span-12 md:col-span-10">
            <h2 className="display text-5xl md:text-7xl">
              Vier Stück.<br />
              <span className="editorial text-[var(--fg-3)] font-normal">
                jede macht ihr eigenes Ding.
              </span>
            </h2>
          </div>
        </div>

        <div className="divide-y divide-[var(--line-strong)] border-y border-[var(--line-strong)]">
          {APPS.map((app, i) => (
            <article
              key={app.slug}
              id={app.slug}
              className="grid grid-cols-12 gap-4 md:gap-8 py-8 md:py-12 group"
            >
              <div className="col-span-12 md:col-span-1">
                <span className="label">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <div className="col-span-3 md:col-span-2">
                <div className="relative aspect-square w-full max-w-[120px]">
                  <Image
                    src={app.icon}
                    alt={app.name}
                    fill
                    sizes="120px"
                    className="object-contain"
                  />
                </div>
              </div>
              <div className="col-span-9 md:col-span-6">
                <h3 className="display text-3xl md:text-5xl mb-2">
                  {app.name}
                </h3>
                <p className="editorial text-xl md:text-2xl text-[var(--fg-2)] mb-4">
                  {app.pitch}
                </p>
                <p className="text-[var(--fg-2)] text-sm md:text-base leading-relaxed max-w-xl">
                  {app.longPitch}
                </p>
              </div>
              <div className="col-span-12 md:col-span-3 flex md:flex-col gap-3 md:gap-4 md:items-end items-start">
                <span
                  className={`label-fg px-3 py-1.5 brut-line ${
                    app.status === "LIVE"
                      ? "bg-[var(--accent-3)] text-[var(--bg)] border-[var(--accent-3)]"
                      : ""
                  }`}
                >
                  {app.status}
                </span>
                {app.storeUrl ? (
                  <Link
                    href={app.storeUrl}
                    target="_blank"
                    className="label-fg brut-line px-3 py-1.5 hover:bg-[var(--fg)] hover:text-[var(--bg)] transition"
                  >
                    App Store ↗
                  </Link>
                ) : (
                  <span className="label">benachrichtigen ↗</span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ─────────── TIKTOK ─────────── */}
      <section className="px-6 md:px-12 py-20 md:py-32 border-b border-[var(--line-strong)] relative overflow-hidden">
        <div className="grid grid-cols-12 gap-8 items-end">
          <div className="col-span-12 md:col-span-8">
            <p className="label mb-6">005 // FOLLOW</p>
            <h2 className="display text-6xl md:text-9xl leading-[0.9]">
              auf <span className="text-[var(--accent)]">tiktok</span>
              <span className="cursor-blink"></span>
            </h2>
            <p className="editorial text-2xl md:text-3xl text-[var(--fg-2)] mt-6 max-w-xl">
              Behind-the-Scenes, Build-in-Public, Micro-Drops. Da passiert alles.
            </p>
          </div>
          <div className="col-span-12 md:col-span-4 md:text-right">
            <Link
              href="https://www.tiktok.com/@klar"
              target="_blank"
              className="inline-block label-fg brut-line-thick px-6 py-4 text-base hover:bg-[var(--accent)] hover:text-[var(--bg)] hover:border-[var(--accent)] transition"
            >
              @klar — abonnieren ↗
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────── FOOTER ─────────── */}
      <footer className="px-6 md:px-12 py-10">
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 md:col-span-6 flex items-center gap-3">
            <span className="display text-2xl">klar</span>
            <span className="label">// © 2026 — Made in CH</span>
          </div>
          <div className="col-span-6 md:col-span-3">
            <p className="label mb-2">Studio</p>
            <Link href="#manifesto" className="block text-[var(--fg-2)] hover:text-[var(--fg)] transition text-sm py-0.5">
              Manifesto
            </Link>
            <Link href="mailto:hi@klar.studio" className="block text-[var(--fg-2)] hover:text-[var(--fg)] transition text-sm py-0.5">
              hi@klar.studio
            </Link>
          </div>
          <div className="col-span-6 md:col-span-3">
            <p className="label mb-2">Social</p>
            <Link href="https://www.tiktok.com/@klar" target="_blank" className="block text-[var(--fg-2)] hover:text-[var(--fg)] transition text-sm py-0.5">
              TikTok ↗
            </Link>
            <Link href="https://www.instagram.com/klar" target="_blank" className="block text-[var(--fg-2)] hover:text-[var(--fg)] transition text-sm py-0.5">
              Instagram ↗
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
