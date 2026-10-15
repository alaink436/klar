import type { Metadata } from "next";
import Link from "next/link";
import { findKlarApp } from "@/lib/klarApps";
import { AppleSvg, PlaySvg } from "../StoreBadges";
import AndroidInstallBar from "../AndroidInstallBar";
import DissolveWord from "../home/DissolveWord";
import Film from "../home/Film";
import Site, { SUPPORT_EMAIL } from "../home/Site";

// The page a creator link opens on a computer, one per app: getklar.org/<app>
// (getklar.org/<app>/<handle> -> Detour -> here with ?ref=). Built from the
// Basalt page of 2026-10-14/15 (Alain: front-page frame, no glass, the last
// word breaks into dust, two large phones in a fan, phone first): the front
// phone plays the app's film, the one behind shows a real screen of the app.
//
// Phones get an install banner: Safari draws Apple's Smart App Banner from the
// itunes metadata; on Android, where the app is on Play, a bar calls Chrome's
// beforeinstallprompt through the app's manifest (related_applications) and
// falls back to the Play listing. Store links and icon come from klarApps.

export type Landing = {
  /** Folder under /public with the film, screen and manifest; also the bar's key. */
  id: string;
  /** klarApps slug. */
  registry: string;
  name: string;
  /** Short category under the name, e.g. "Weekly habits". */
  kind: string;
  /** The headline; its last word breaks into dust. */
  headline: string;
  sub: string;
  features: { title: string; line: string }[];
  /** Film path without extension (.mp4 with a .jpg poster next to it), tall cut. */
  film: string;
  filmLabel: string;
  /** Screen recordings bring their own status bar and island; renders do not. */
  filmHasIsland?: boolean;
  /** A real screen of the app for the phone behind; without one, a single phone. */
  screen?: { src: string; alt: string };
  privacy?: string;
  terms?: string;
  /** Only what is known for this app, e.g. where its data is stored. */
  note?: string;
  title: string;
  description: string;
};

const app = (l: Landing) => findKlarApp(l.registry)!;

export function landingMetadata(l: Landing): Metadata {
  const a = app(l);
  const appId = a.appStoreUrl?.match(/id(\d+)/)?.[1];
  return {
    title: l.title,
    description: l.description,
    robots: { index: true, follow: true },
    ...(appId ? { itunes: { appId } } : {}),
    // Only for Android's install sheet, so only where the app is on Play.
    ...(a.playStoreUrl ? { manifest: `/${l.id}/${l.id}.webmanifest` } : {}),
  };
}

function StoreButtons({ l }: { l: Landing }) {
  const a = app(l);
  return (
    <div className="flex flex-wrap gap-3">
      {a.appStoreUrl && (
        <a
          href={a.appStoreUrl}
          className="inline-flex h-12 items-center gap-2.5 rounded-full bg-[var(--ink)] px-6 text-[15px] font-medium tracking-[-0.01em] text-[var(--paper)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:opacity-85"
        >
          <AppleSvg size={17} />
          App Store
        </a>
      )}
      {a.playStoreUrl && (
        <a
          href={a.playStoreUrl}
          className="inline-flex h-12 items-center gap-2.5 rounded-full border border-white/70 bg-white/50 px-6 text-[15px] font-medium tracking-[-0.01em] shadow-[0_8px_24px_-14px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl transition hover:bg-white/80"
        >
          <PlaySvg size={17} />
          Google Play
        </a>
      )}
    </div>
  );
}

function Phone({ children, period }: { children: React.ReactNode; period: number }) {
  return (
    <div className="home-phone-bob" style={{ animationDuration: `${period}s` }}>
      <div className="relative aspect-[482/1000] drop-shadow-[0_40px_50px_rgba(0,0,0,0.26)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/home/iphone.webp" alt="" className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-x-[4.4%] inset-y-[2.3%] overflow-hidden rounded-[11%/5.3%] bg-[#dcdcda]">{children}</div>
      </div>
    </div>
  );
}

// Two phones fanned from a shared point below them: the app's screen tilted
// back on the left, the film in front on the right. On a computer the fan is
// as tall as the window allows; on a phone it runs edge to edge, the front
// phone 62 % of the screen wide and the back one leaving past the left edge.
// Without a real screen there is one phone, centred and a little larger.
function PhoneFan({ l }: { l: Landing }) {
  const film = (
    <Phone period={7}>
      <Film wide={l.film} label={l.filmLabel} className="h-full w-full" />
      {!l.filmHasIsland && <div className="absolute left-1/2 top-[1.8%] h-[3.4%] w-[30%] -translate-x-1/2 rounded-full bg-black" />}
    </Phone>
  );
  return (
    <div className="home-phone-rise relative -mx-5 aspect-[10/13.4] w-[calc(100%+40px)] sm:mx-auto sm:w-[min(100%,560px)] md:aspect-[10/11] md:w-[min(100%,calc((100svh-150px)*0.909),640px)]">
      {l.screen ? (
        <>
          <div className="absolute -left-[5%] top-[7%] w-[54%] origin-bottom -rotate-[9deg] md:left-[4%] md:top-[6%] md:w-[46%]">
            <Phone period={8.2}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={l.screen.src} alt={l.screen.alt} className="h-full w-full object-cover" />
            </Phone>
          </div>
          <div className="absolute right-[3%] top-0 w-[62%] origin-bottom rotate-[4deg] md:right-[4%] md:w-[50%]">{film}</div>
        </>
      ) : (
        <div className="absolute left-[19%] top-0 w-[62%] origin-bottom rotate-[3deg] md:left-[23%] md:w-[54%]">{film}</div>
      )}
    </div>
  );
}

export default function AppLanding({ l }: { l: Landing }) {
  const a = app(l);
  const words = l.headline.split(" ");
  const last = words.pop()!;
  const platforms = a.playStoreUrl ? "iPhone and Android" : "iPhone";
  return (
    <Site>
      <main className="relative overflow-hidden">
        <div className="home-grid absolute inset-0" aria-hidden="true" />
        <div className="home-glow absolute inset-0" aria-hidden="true" />

        <section className="relative mx-auto grid max-w-[1280px] items-center gap-6 px-5 pb-12 pt-24 sm:px-8 md:min-h-svh md:grid-cols-[0.95fr_1.05fr] md:gap-4 md:pb-10 md:pt-24">
          <div>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.icon} alt="" className="size-12 rounded-[12px] shadow-[0_6px_18px_-8px_rgba(0,0,0,0.35)]" />
              <div>
                <p className="text-[17px] font-semibold tracking-[-0.03em]">{l.name}</p>
                <p className="text-[13px] font-medium text-[var(--ink-3)]">
                  {l.kind} · {platforms}
                </p>
              </div>
            </div>

            <h1 className="mt-6 text-[clamp(44px,5.4vw,84px)] font-medium leading-[0.9] tracking-[-0.055em] md:mt-8">
              {words.join(" ")} <DissolveWord>{last}</DissolveWord>
            </h1>

            <p className="mt-5 max-w-[520px] text-[16px] leading-[1.5] text-[var(--ink-2)] md:mt-7 md:text-[17px]">{l.sub}</p>

            <div className="mt-7 md:mt-9">
              <StoreButtons l={l} />
            </div>
          </div>

          <PhoneFan l={l} />
        </section>

        <section className="relative mx-auto max-w-[1280px] px-5 pb-28 sm:px-8 md:pb-28">
          <div className="grid gap-px overflow-hidden rounded-[28px] border bg-[var(--hair)] sm:grid-cols-2">
            {l.features.map((f) => (
              <div key={f.title} className="bg-[var(--paper)]/90 p-7 backdrop-blur-sm md:p-9">
                <h2 className="text-[22px] font-medium tracking-[-0.03em]">{f.title}</h2>
                <p className="mt-2.5 max-w-[440px] text-[15px] leading-[1.55] text-[var(--ink-3)]">{f.line}</p>
              </div>
            ))}
          </div>

          <p className="mt-10 text-[13px] leading-[2] text-[var(--ink-3)]">
            {l.privacy && (
              <>
                <Link href={l.privacy} className="underline underline-offset-2 hover:text-[var(--ink)]">Privacy Policy</Link>
                {" · "}
              </>
            )}
            {l.terms && (
              <>
                <Link href={l.terms} className="underline underline-offset-2 hover:text-[var(--ink)]">Terms of Use</Link>
                {" · "}
              </>
            )}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-2 hover:text-[var(--ink)]">{SUPPORT_EMAIL}</a>
            <br />
            Made by Alain Kessler in Switzerland.{l.note ? ` ${l.note}` : ""}
          </p>
        </section>
      </main>

      {a.playStoreUrl && (
        <AndroidInstallBar id={l.id} name={l.name} line={l.kind} icon={a.icon} playUrl={a.playStoreUrl} />
      )}
    </Site>
  );
}
