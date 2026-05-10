import Image from "next/image";
import Link from "next/link";

type Status = "LIVE" | "BETA" | "BUILD" | "IDEA";

interface App {
  slug: string;
  name: string;
  pitch: string;
  longPitch: string;
  status: Status;
  buildNote: string;       // tiny build-in-public note
  storeUrl?: string;
  icon: string;
  tilt: string;            // CSS class for slight rotation
}

const APPS: App[] = [
  {
    slug: "trubel",
    name: "Trubel",
    pitch: "Drop a pin. Fill it with photos.",
    longPitch:
      "Geo-getaggte Foto-Alben mit Zeitfenster, geteilt per QR-Code. Beim Trigger-Zeitpunkt nach dem Event scannt die App deine Camera Roll und schlägt automatisch passende Fotos zum Upload vor. Alle Alben landen als Pins auf einer Welt-Karte.",
    status: "BUILD",
    buildNote: "build #2 · y2k onboarding fertig",
    icon: "/icons/trubel.png",
    tilt: "tilt-1",
  },
  {
    slug: "myloo",
    name: "MyLoo",
    pitch: "Stuhl-Tracking. Ohne dass es eklig wird.",
    longPitch:
      "Foto machen, Vision-AI klassifiziert nach Bristol-Skala. Für Menschen mit IBS, Crohn, Colitis und Eltern, die ihre Gesundheit dokumentieren wollen — ohne Friction. Bilder bleiben lokal, Cloud-Sync ist Opt-in.",
    status: "BETA",
    buildNote: "ASC submitted · review läuft",
    icon: "/icons/myloo.png",
    tilt: "tilt-2",
  },
  {
    slug: "wavelength",
    name: "Wavelength",
    pitch: "Plan smarter, together.",
    longPitch:
      "Persönlicher Kalender + Voting-Tool für Friends- und Sport-Groups. Heatmap-Abstimmung, Vision-OCR für Aushänge, sport-spezifische Lineups. Der Gruppen-Plan, der nicht nervt.",
    status: "BUILD",
    buildNote: "native build #2 · push pending",
    icon: "/icons/wavelength.png",
    tilt: "tilt-3",
  },
  {
    slug: "yarn-stash",
    name: "Yarn-Stash",
    pitch: "Stash. Match. Knit.",
    longPitch:
      "Garn-Inventar, Pattern-Matching via Ravelry und Projekt-Tracker für Stricker:innen. Banderole scannen, Vision-AI extrahiert alles automatisch. Macht die Arbeit, die Ravelry vergessen hat.",
    status: "LIVE",
    buildNote: "v1 · App Store · 4★+",
    storeUrl: "https://apps.apple.com/app/yarn-stash",
    icon: "/icons/yarnstash.png",
    tilt: "tilt-4",
  },
];

const STATUS_COLOR: Record<Status, string> = {
  LIVE: "var(--accent-3)",
  BETA: "var(--accent-2)",
  BUILD: "var(--accent)",
  IDEA: "var(--fg-3)",
};

const TODAY = "10.05.26";

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      {/* ─────────── TOP MARQUEE ─────────── */}
      <div className="border-b border-[var(--line-strong)] overflow-hidden">
        <div className="flex marquee whitespace-nowrap py-2.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              className="label-fg px-4 sm:px-6 shrink-0 flex items-center gap-4 sm:gap-6"
            >
              klar
              <span className="text-[var(--accent)]">●</span>
              ein-mann studio
              <span className="text-[var(--accent)]">●</span>
              bern, ch
              <span className="text-[var(--accent)]">●</span>
              4 apps · 1 mascot-familie
              <span className="text-[var(--accent)]">●</span>
              hi alain hier
              <span className="text-[var(--accent)]">●</span>
            </span>
          ))}
        </div>
      </div>

      {/* ─────────── NAV ─────────── */}
      <nav className="flex items-center justify-between px-4 sm:px-6 md:px-12 py-4 md:py-6 border-b border-[var(--line-strong)]">
        <div className="flex items-baseline gap-2 sm:gap-3">
          <span className="display text-xl sm:text-2xl">klar</span>
          <span className="label hidden xs:inline">v0.1 · {TODAY}</span>
        </div>
        <div className="flex items-center gap-4 sm:gap-6 md:gap-10">
          <Link href="#apps" className="label hover:text-[var(--fg)] transition">
            Apps
          </Link>
          <Link
            href="#wer"
            className="label hidden sm:inline hover:text-[var(--fg)] transition"
          >
            Wer
          </Link>
          <Link
            href="https://www.tiktok.com/@klar"
            target="_blank"
            className="label-fg flex items-center gap-1.5 group"
          >
            <span className="text-[var(--accent)] group-hover:text-[var(--accent-3)] transition">
              ●
            </span>
            @klar
          </Link>
        </div>
      </nav>

      {/* ─────────── HERO ─────────── */}
      <section className="px-4 sm:px-6 md:px-12 pt-8 sm:pt-12 md:pt-20 pb-10 sm:pb-16 md:pb-24 border-b border-[var(--line-strong)] relative">
        {/* tiny header marker */}
        <div className="flex items-baseline justify-between mb-6 sm:mb-10">
          <p className="label">001 // hi.</p>
          <p className="label">bern · ch · {TODAY}</p>
        </div>

        {/* the wordmark — overflows on purpose */}
        <h1 className="display t-wordmark text-[var(--fg)] -ml-1 sm:-ml-2 leading-[0.84]">
          klar<span className="text-[var(--accent)]">.</span>
        </h1>

        {/* footnote-style tagline */}
        <div className="grid grid-cols-12 gap-4 sm:gap-6 mt-8 sm:mt-12 md:mt-16">
          <div className="col-span-1 md:col-span-2 flex justify-center md:justify-end pt-2">
            <span className="label">↳</span>
          </div>
          <div className="col-span-11 md:col-span-7 max-w-2xl">
            <p className="editorial t-editorial-xl">
              Wir bauen Apps,<br />
              die nicht <span className="text-[var(--accent)]">langweilen</span>.
            </p>
            <p className="t-body-lg text-[var(--fg-2)] mt-5 sm:mt-7 max-w-md">
              Vier Apps. Eine Crew. Ein Mensch in der Mitte (
              <span className="fn" title="das bin ich, alain">
                hi
              </span>
              ). Gemacht für die Leute, die zwischen TikTok-Loops und echtem
              Leben pendeln.
            </p>
          </div>
          <div className="hidden md:flex md:col-span-3 flex-col items-end justify-end">
            <span className="label mb-2">↘ scroll</span>
            <span className="text-[var(--fg-3)] text-sm">001 · 002 · 003 · 004</span>
          </div>
        </div>
      </section>

      {/* ─────────── CREST ─────────── */}
      <section className="px-4 sm:px-6 md:px-12 py-12 sm:py-20 md:py-28 border-b border-[var(--line-strong)] relative">
        <div className="flex items-baseline justify-between mb-8 sm:mb-12 md:mb-16">
          <p className="label">002 // die crest.</p>
          <p className="label hidden sm:inline">vier charaktere</p>
        </div>

        <div className="text-center mb-8 sm:mb-14">
          <h2 className="editorial t-editorial-xl">
            Die <span className="text-[var(--accent)]">Familie</span>.
          </h2>
          <p className="label mt-3 sm:mt-4">
            ↓ tap um zur app zu scrollen
          </p>
        </div>

        {/* Crest grid: 2x2 icons + central logo */}
        <div className="relative mx-auto w-full max-w-[640px] aspect-square">
          {/* radial glow behind logo */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="w-[55%] h-[55%] rounded-full"
              style={{
                background:
                  "radial-gradient(circle, oklch(0.72 0.32 348 / 0.22) 0%, oklch(0.78 0.18 240 / 0.10) 35%, transparent 70%)",
              }}
            />
          </div>

          {/* 2x2 grid */}
          <div className="grid grid-cols-2 gap-3 sm:gap-6 md:gap-10 relative z-10">
            {APPS.map((app) => (
              <Link
                key={app.slug}
                href={`#${app.slug}`}
                className={`icon-card group flex flex-col items-center ${app.tilt}`}
              >
                <div className="relative w-full aspect-square">
                  <Image
                    src={app.icon}
                    alt={app.name}
                    fill
                    sizes="(max-width: 640px) 40vw, (max-width: 1024px) 25vw, 280px"
                    className="object-contain"
                    priority
                  />
                </div>
                <div className="mt-2 sm:mt-3 flex flex-col items-center gap-0.5 sm:gap-1">
                  <span className="display text-base sm:text-xl md:text-2xl">
                    {app.name}
                  </span>
                  <span
                    className="label"
                    style={{ color: STATUS_COLOR[app.status] }}
                  >
                    {app.status === "LIVE" && "● "}
                    {app.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* central chrome logo overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-[24%] sm:w-[26%] aspect-square logo-glow">
              <Image
                src="/logo/klar-symbol.png"
                alt="Klar"
                fill
                sizes="(max-width: 640px) 24vw, 200px"
                className="object-contain"
                priority
              />
            </div>
          </div>
        </div>

        {/* footnote below crest */}
        <p className="label text-center mt-8 sm:mt-12 max-w-md mx-auto">
          *die mascots reden manchmal mit mir. das logo nicht.
        </p>
      </section>

      {/* ─────────── WER (about, personal) ─────────── */}
      <section
        id="wer"
        className="px-4 sm:px-6 md:px-12 py-12 sm:py-20 md:py-28 border-b border-[var(--line-strong)]"
      >
        <div className="flex items-baseline justify-between mb-8 sm:mb-12 md:mb-16">
          <p className="label">003 // wer.</p>
          <p className="label hidden sm:inline">ein-mann studio</p>
        </div>

        <div className="grid grid-cols-12 gap-y-6 sm:gap-y-10 md:gap-x-12">
          <div className="col-span-12 md:col-span-7">
            <p className="editorial t-editorial-xl">
              Alain Kessler.<br />
              <span className="text-[var(--fg-3)]">CH. Seit 2026.</span>
            </p>
          </div>
          <div className="col-span-12 md:col-span-5 max-w-md">
            <p className="t-body-lg text-[var(--fg-2)]">
              Kein Pitchdeck. Kein Roadmap-Theater. Bau, deploy, schau ob jemand
              klickt, wiederhole. Klar ist mein Studio-Label für Apps, die
              tatsächlich Spass machen sollen — nicht für Apps, die deine
              «Productivity» messen.
            </p>
            <p className="t-body-lg text-[var(--fg-3)] mt-4">
              ThrottleUp und Kelva gibts auch.{" "}
              <span className="fn" title="andere zielgruppe — eher b2c-utility ohne dopamin-loop">
                Aber die sind nicht hier
              </span>
              .
            </p>
          </div>
        </div>
      </section>

      {/* ─────────── MANIFESTO ─────────── */}
      <section className="px-4 sm:px-6 md:px-12 py-14 sm:py-20 md:py-32 border-b border-[var(--line-strong)] relative">
        <div className="flex items-baseline justify-between mb-8 sm:mb-12 md:mb-16">
          <p className="label">004 // was klar nicht ist.</p>
          <p className="label hidden sm:inline">anti-ai-look manifesto</p>
        </div>

        <div className="max-w-5xl">
          <p className="display t-display mb-6 sm:mb-10">
            Keine «AI-Powered».<br />
            <span className="text-[var(--fg-3)]">Keine</span>
            {" "}
            <span className="editorial italic font-normal">
              «Reimagining the future».
            </span>
          </p>
          <p className="display t-display mb-6 sm:mb-10">
            Keine Newsletter, bevor du<br />
            wo geklickt hast.
          </p>
          <p className="display t-display">
            Nur vier Apps. Und der<br />
            <span className="text-[var(--accent)]">Hintergrund</span>.
          </p>
        </div>

        <p className="label mt-10 sm:mt-16 max-w-md">
          ↳ ja, der hintergrund ist schwarz. wir wissen, das ist 2024-coded. aber chrome glänzt halt nicht auf weiss.
        </p>
      </section>

      {/* ─────────── APPS ─────────── */}
      <section id="apps" className="px-4 sm:px-6 md:px-12 py-12 sm:py-20 md:py-28">
        <div className="flex items-baseline justify-between mb-8 sm:mb-12 md:mb-16">
          <p className="label">005 // apps.</p>
          <p className="label">live · beta · build</p>
        </div>

        <h2 className="display t-display mb-10 sm:mb-16">
          Vier Stück.{" "}
          <span className="editorial text-[var(--fg-3)] font-normal italic">
            jede macht ihr eigenes Ding.
          </span>
        </h2>

        <div className="border-t border-[var(--line-strong)]">
          {APPS.map((app, i) => (
            <article
              key={app.slug}
              id={app.slug}
              className="border-b border-[var(--line-strong)] py-8 sm:py-12 md:py-14 grid grid-cols-12 gap-4 md:gap-6 group"
            >
              {/* Number */}
              <div className="col-span-2 md:col-span-1">
                <span className="label">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>

              {/* Icon */}
              <div className="col-span-3 md:col-span-2">
                <div className={`relative aspect-square w-full max-w-[120px] ${app.tilt}`}>
                  <Image
                    src={app.icon}
                    alt={app.name}
                    fill
                    sizes="120px"
                    className="object-contain"
                  />
                </div>
              </div>

              {/* Name + pitch */}
              <div className="col-span-7 md:col-span-6">
                <h3 className="display text-3xl sm:text-4xl md:text-6xl mb-1 sm:mb-2">
                  {app.name}
                </h3>
                <p className="editorial t-editorial-lg text-[var(--fg-2)] mb-3 sm:mb-4">
                  {app.pitch}
                </p>
                <p className="t-body-lg text-[var(--fg-2)] max-w-xl hidden sm:block">
                  {app.longPitch}
                </p>
              </div>

              {/* Status sidebar */}
              <div className="col-span-12 md:col-span-3 flex flex-col gap-2 md:gap-3 md:items-end md:text-right border-t md:border-t-0 md:border-l border-[var(--line)] md:pl-6 pt-3 md:pt-0">
                <span
                  className="label-fg w-fit md:w-auto px-2 py-1 brut-line"
                  style={
                    app.status === "LIVE"
                      ? {
                          background: "var(--accent-3)",
                          color: "var(--bg)",
                          borderColor: "var(--accent-3)",
                        }
                      : {}
                  }
                >
                  {app.status}
                </span>
                <span className="label">{app.buildNote}</span>
                {app.storeUrl ? (
                  <Link
                    href={app.storeUrl}
                    target="_blank"
                    className="label-fg brut-line w-fit md:w-auto px-2 py-1 hover:bg-[var(--fg)] hover:text-[var(--bg)] transition"
                  >
                    App Store ↗
                  </Link>
                ) : (
                  <span className="label">— bald —</span>
                )}
              </div>

              {/* Long pitch shown only on mobile under everything */}
              <div className="col-span-12 sm:hidden">
                <p className="t-body-lg text-[var(--fg-2)]">{app.longPitch}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ─────────── TIKTOK ─────────── */}
      <section className="px-4 sm:px-6 md:px-12 py-14 sm:py-24 md:py-32 border-t border-[var(--line-strong)] relative overflow-hidden">
        <div className="flex items-baseline justify-between mb-8 sm:mb-12 md:mb-16">
          <p className="label">006 // follow.</p>
          <p className="label hidden sm:inline">build-in-public</p>
        </div>

        <h2 className="display t-display mb-6">
          @klar.<br />
          <span className="text-[var(--accent)]">tiktok</span>
          <span className="cursor-blink"></span>
        </h2>

        <div className="grid grid-cols-12 gap-6 mt-8 sm:mt-12 items-end">
          <div className="col-span-12 md:col-span-7">
            <p className="editorial t-editorial-lg text-[var(--fg-2)] max-w-xl">
              Wir filmen nichts. Wir uploaden, was passiert. Build-in-Public,
              Glitches inklusive.
            </p>
          </div>
          <div className="col-span-12 md:col-span-5 md:text-right">
            <Link
              href="https://www.tiktok.com/@klar"
              target="_blank"
              className="inline-block label-fg brut-line-thick px-4 sm:px-6 py-3 sm:py-4 text-sm hover:bg-[var(--accent)] hover:text-[var(--bg)] hover:border-[var(--accent)] transition"
            >
              @klar abonnieren ↗
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────── FOOTER ─────────── */}
      <footer className="px-4 sm:px-6 md:px-12 py-8 sm:py-12 border-t border-[var(--line-strong)]">
        <div className="grid grid-cols-12 gap-6 sm:gap-8">
          <div className="col-span-12 md:col-span-6">
            <div className="flex items-baseline gap-3 mb-2">
              <span className="display text-3xl sm:text-4xl">klar</span>
              <span className="label">v0.1 · {TODAY}</span>
            </div>
            <p className="label">
              made in bern with coffee + cursor + claude
            </p>
          </div>
          <div className="col-span-6 md:col-span-3">
            <p className="label mb-3">studio</p>
            <Link
              href="#wer"
              className="block text-[var(--fg-2)] hover:text-[var(--fg)] transition text-sm py-0.5"
            >
              Wer ist klar?
            </Link>
            <Link
              href="mailto:hi@klar.studio"
              className="block text-[var(--fg-2)] hover:text-[var(--fg)] transition text-sm py-0.5"
            >
              hi@klar.studio
            </Link>
          </div>
          <div className="col-span-6 md:col-span-3">
            <p className="label mb-3">social</p>
            <Link
              href="https://www.tiktok.com/@klar"
              target="_blank"
              className="block text-[var(--fg-2)] hover:text-[var(--fg)] transition text-sm py-0.5"
            >
              TikTok ↗
            </Link>
            <Link
              href="https://www.instagram.com/klar"
              target="_blank"
              className="block text-[var(--fg-2)] hover:text-[var(--fg)] transition text-sm py-0.5"
            >
              Instagram ↗
            </Link>
          </div>
        </div>

        <div className="mt-8 sm:mt-10 pt-6 border-t border-[var(--line)] flex flex-col sm:flex-row justify-between gap-2">
          <p className="label">
            last touched {TODAY} · sometimes daily, sometimes monthly
          </p>
          <p className="label">© 2026 alain kessler. ch.</p>
        </div>
      </footer>
    </main>
  );
}
