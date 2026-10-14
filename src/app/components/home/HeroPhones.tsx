import { AppleSvg, PlaySvg } from "../StoreBadges";

// The hero's phones (Alain, 2026-10-14): one iPhone per app, each at its own
// depth, height and float period, rising in from the bottom. The body is the
// real model rendered straight on (public/home/iphone.webp, script in
// AI-Brain Projects/Klar/Content/web-hero/phone-frame.py); the screen is HTML
// on top of it: icon, name, where the app is out. A click jumps to the app's
// section. Weekly user numbers come later, once they are worth showing.

export type HeroPhoneApp = { id: string; name: string; icon: string; play?: string; soon: boolean };

// left %, top % (how far down the phone starts), depth (scale), tilt, float period in s
const POSE = [
  { left: 4, top: 14, z: 0.86, rot: -5, period: 6.2 },
  { left: 19, top: 6, z: 1.0, rot: 3, period: 7.4 },
  { left: 34, top: 15, z: 0.9, rot: -2, period: 5.6 },
  { left: 50, top: 3, z: 1.06, rot: 4, period: 6.8 },
  { left: 65, top: 11, z: 0.94, rot: -3, period: 7.9 },
  { left: 80, top: 8, z: 0.88, rot: 5, period: 6.0 },
];

function Screen({ app }: { app: HeroPhoneApp }) {
  return (
    <div className="absolute inset-x-[4.4%] inset-y-[2.3%] overflow-hidden rounded-[11%/5.3%] bg-black [container-type:inline-size]">
      {/* the icon, blown up and blurred, is the wallpaper: every phone gets its app's colour */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={app.icon} alt="" className="absolute inset-0 h-full w-full scale-150 object-cover opacity-80 blur-2xl saturate-150" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/70" />
      <div className="absolute left-1/2 top-[1.8%] h-[3.4%] w-[30%] -translate-x-1/2 rounded-full bg-black" />

      {/* Only the top half shows above the fold, so everything sits up there. */}
      <div className="relative flex h-full flex-col items-center px-[11%] pt-[17cqw] text-center text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={app.icon} alt="" className="w-[38%] rounded-[22.5%] shadow-[0_10px_30px_rgba(0,0,0,0.45)]" />
        <p className="mt-[6cqw] text-[9.5cqw] font-semibold leading-none tracking-[-0.03em]">{app.name}</p>
        <div className="mt-[7cqw] flex w-full flex-col gap-[2.5cqw]">
          {app.soon ? (
            <span className="rounded-full border border-white/40 bg-white/15 py-[3.4cqw] text-[6.4cqw] font-medium backdrop-blur-md">
              Coming soon
            </span>
          ) : (
            <>
              <span className="inline-flex items-center justify-center gap-[2.4cqw] rounded-full bg-white py-[3.4cqw] text-[6.4cqw] font-medium text-black">
                <AppleSvg size={11} />
                App Store
              </span>
              {app.play && (
                <span className="inline-flex items-center justify-center gap-[2.4cqw] rounded-full border border-white/40 bg-white/15 py-[3.4cqw] text-[6.4cqw] font-medium backdrop-blur-md">
                  <PlaySvg size={11} />
                  Google Play
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HeroPhones({ apps }: { apps: HeroPhoneApp[] }) {
  return (
    // Clipped at the bottom only, about halfway down the phones (Alain: "nur die
    // Hälfte des Bildschirms"), like the screenshot fan before; the top stays open
    // so the tallest phone's float is not cut.
    <div className="relative mx-auto mt-14 h-[clamp(170px,17vw,250px)] max-w-[1180px] [clip-path:inset(-200%_-20%_0_-20%)] md:mt-20">
      {apps.map((app, i) => {
        const p = POSE[i % POSE.length];
        return (
          <a
            key={app.id}
            href={`#${app.id}`}
            aria-label={`${app.name}: jump to the app`}
            className={`home-phone group absolute w-[clamp(96px,13.5vw,196px)] ${i === 0 || i === 5 ? "hidden sm:block" : ""}`}
            style={
              {
                left: `${p.left}%`,
                top: `${p.top}%`,
                zIndex: Math.round(p.z * 10),
                "--rot": `${p.rot}deg`,
                "--z": p.z,
              } as React.CSSProperties
            }
          >
            <div className="home-phone-rise" style={{ animationDelay: `${0.15 + i * 0.09}s` }}>
              <div className="home-phone-bob" style={{ animationDuration: `${p.period}s`, animationDelay: `${-i * 1.3}s` }}>
                <div className="relative aspect-[482/1000] drop-shadow-[0_30px_40px_rgba(0,0,0,0.28)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/home/iphone.webp" alt="" className="absolute inset-0 h-full w-full" />
                  <Screen app={app} />
                </div>
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}
