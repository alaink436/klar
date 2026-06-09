// "Targets nach App" — the per-app pipeline overview, on the shadcn kit.
// Replaces the old renderInfluencerMini / renderBucketCol / targetsByAppSection
// HTML strings. Pure presentational (native <details> toggle, no hooks), so it
// renders as a server component. Data is computed in page.tsx and passed plain.

import { Card } from "@/components/ui/card";

export interface TargetMini {
  handle: string;
  profileUrl: string | null;
  platform: string;
  followerLabel: string;
  niche: string | null;
  contactEmail: string | null;
  lastMessage: string | null;
  sentRel: string;
}
export interface AppBuckets {
  slug: string;
  name: string;
  angefragt: TargetMini[];
  reply: TargetMini[];
  angenommen: TargetMini[];
}

function Mini({ t }: { t: TargetMini }) {
  return (
    <div className="flex items-center justify-between gap-2 px-2.5 py-2 border-b border-line last:border-b-0 text-[12px]">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {t.profileUrl ? (
            <a href={t.profileUrl} target="_blank" rel="noopener" className="font-semibold text-fg hover:underline truncate">
              @{t.handle}
            </a>
          ) : (
            <span className="font-semibold text-fg truncate">@{t.handle}</span>
          )}
          <span className="[font-family:var(--font-mono)] text-[8px] px-1.5 py-px border border-line-strong rounded text-fg-3 shrink-0">
            {t.platform === "tiktok" ? "TT" : "IG"}
          </span>
          {t.followerLabel && <span className="[font-family:var(--font-mono)] text-[10px] text-fg-4 shrink-0">{t.followerLabel}</span>}
          {t.niche && t.niche !== "—" && (
            <span
              className="[font-family:var(--font-mono)] text-[8px] px-1.5 py-px border border-line-strong rounded text-fg-3 shrink-0 truncate max-w-[120px]"
              title={`Herkunft: #${t.niche}`}
            >
              #{t.niche}
            </span>
          )}
        </div>
        {t.contactEmail && <div className="[font-family:var(--font-mono)] text-[10px] text-fg-4 truncate">{t.contactEmail}</div>}
        {t.lastMessage && (
          <div className="text-[10px] text-fg-4 italic truncate" title={t.lastMessage}>
            ↩ {t.lastMessage}
          </div>
        )}
      </div>
      <span className="text-[10px] text-fg-4 whitespace-nowrap">{t.sentRel}</span>
    </div>
  );
}

function Col({ label, icon, items }: { label: string; icon: string; items: TargetMini[] }) {
  return (
    <div className="border border-line rounded-[var(--radius-sm)] bg-surface min-h-[120px]">
      <div className="flex items-baseline justify-between px-3 py-2.5 border-b border-line">
        <span className="[font-family:var(--font-mono)] text-[10.5px] font-semibold uppercase tracking-[0.1em] text-fg-2">
          {icon} {label}
        </span>
        <span className="[font-family:var(--font-display)] font-extrabold text-[18px] text-fg [font-variant-numeric:tabular-nums]">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="text-fg-4 italic text-[11px] px-3 py-3">keine Einträge</div>
      ) : (
        <>
          {items.slice(0, 8).map((t, i) => (
            <Mini key={`${t.handle}-${i}`} t={t} />
          ))}
          {items.length > 8 && <div className="text-fg-4 text-[11px] px-3 py-2">+ {items.length - 8} weitere</div>}
        </>
      )}
    </div>
  );
}

export default function OutreachTargetsByApp({ data }: { data: AppBuckets[] }) {
  return (
    <section className="mt-8">
      <h2 className="[font-family:var(--font-display)] font-bold text-[18px] tracking-[-0.01em] text-fg">Targets nach App</h2>
      <p className="text-[12px] text-fg-3 mt-1 mb-4 max-w-[80ch]">
        Creator aus der Pipeline pro App, nach Status: Angefragt → Reply → Angenommen. Mehrfach getaggte Targets
        erscheinen in jedem Block, Top 8 pro Spalte.
      </p>
      <div className="flex flex-col gap-3.5">
        {data.map((app) => {
          const total = app.angefragt.length + app.reply.length + app.angenommen.length;
          return (
            <Card key={app.slug} className="p-0 overflow-hidden">
              <details open={total > 0}>
                <summary className="cursor-pointer flex items-center justify-between gap-3 px-5 py-3.5 select-none text-[14px] font-semibold marker:content-none">
                  <span className="text-fg">
                    {app.name} <span className="text-fg-4 font-normal text-[11px] ml-1">{app.slug}</span>
                  </span>
                  <span className="[font-family:var(--font-mono)] text-[11px] text-fg-3 font-normal">
                    {app.angefragt.length} angefragt · {app.reply.length} reply · {app.angenommen.length} angenommen
                  </span>
                </summary>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 px-5 pb-5">
                  <Col label="Angefragt" icon="✉" items={app.angefragt} />
                  <Col label="Reply" icon="↩" items={app.reply} />
                  <Col label="Angenommen" icon="✓" items={app.angenommen} />
                </div>
              </details>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
