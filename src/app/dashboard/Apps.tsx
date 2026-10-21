// The app a creator promotes (Alain 2026-10-21: creators pick the app). Basalt is the one with formats, a kit and
// numbers; the others show as "soon" until they have the same. Plain markup, used in the sign-up form and the
// dashboard alike.

export interface AppChoiceItem {
  name: string;
  icon: string;
  live: boolean;
}

export default function Apps({ apps }: { apps: AppChoiceItem[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {apps.map((a) => (
        <span
          key={a.name}
          aria-disabled={!a.live}
          className={`inline-flex h-11 items-center gap-2 rounded-full border pl-1.5 pr-4 text-[14px] font-medium ${a.live ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]" : "border-[var(--hair)] bg-white/50 text-[var(--ink-3)]"}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={a.icon} alt="" width={32} height={32} className={`size-8 rounded-[22.5%] ${a.live ? "" : "opacity-50 grayscale"}`} />
          {a.name}
          {!a.live && <span className="text-[12px] font-normal">soon</span>}
        </span>
      ))}
    </div>
  );
}
