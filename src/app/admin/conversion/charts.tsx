// Conversion charts in plain HTML, ported from the OurApps dashboard (charts.tsx there): PostHog's funnel
// as steps left to right, and one rate over time as a thin line with the changes as numbered marks. One
// hue, Klar's chart ink (--chart-1), the drop-off hatched in the same hue; a tooltip per bar and point.

import { formatShare, funnelBars, type Bar, type TrendPoint } from "@/lib/conversion";

export function Legend({ items }: { items: { label: string; color: string; outline?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span
            className="inline-block size-2.5 rounded-[3px]"
            style={i.outline ? { boxShadow: `inset 0 0 0 1.5px ${i.color}` } : { background: i.color }}
          />
          {i.label}
        </li>
      ))}
    </ul>
  );
}


const REACHED = "var(--chart-1)";
// The drop-off in the same hue, light and hatched, so it reads as "missing" also without color.
const DROPPED =
  "repeating-linear-gradient(135deg, color-mix(in srgb, var(--chart-1) 38%, transparent) 0 2px, color-mix(in srgb, var(--chart-1) 14%, transparent) 2px 6px)";
export const FUNNEL_LEGEND = [
  { label: "erreicht", color: REACHED },
  {
    label: "abgesprungen",
    color: "color-mix(in srgb, var(--chart-1) 30%, transparent)",
  },
];

/**
 * A funnel as PostHog draws it (steps, left to right): each bar filled to its share of step 1, the
 * drop-off since the step before stacked on top of it, the share of step 1 above, name and counts
 * below, the rest in a tooltip.
 */
export function FunnelBars({ steps, height = 220 }: { steps: { label: string; count: number; note?: string }[]; height?: number }) {
  const bars = funnelBars(steps.map((s) => s.count));
  if (!bars.length || bars[0].count === 0) {
    return <p className="py-10 text-center text-sm text-fg-3">In diesem Zeitraum hat niemand die App installiert.</p>;
  }
  return (
    <div>
      {/* pt-6: room above the 100 % bar for its share */}
      <div className="pt-6">
        <div className="relative pl-10" style={{ height }}>
          {[0, 25, 50, 75, 100].map((p) => (
            <div key={p} className="pointer-events-none absolute right-0 left-10 border-t border-line" style={{ bottom: `${p}%` }}>
              <span className="absolute -top-2 -left-10 w-8 text-right text-[10px] text-fg-4 tabular-nums">{p} %</span>
            </div>
          ))}
          <div className="relative flex h-full items-end gap-3 sm:gap-6">
            {bars.map((b, i) => {
              // The stack reaches the step before (reached plus dropped), the segments split it by count.
              const top = ((b.ofFirst ?? 0) + (b.droppedOfFirst ?? 0)) * 100;
              return (
                <div key={steps[i].label} className="group relative h-full flex-1">
                  <div className="absolute inset-x-0 bottom-0 mx-auto flex max-w-28 flex-col gap-[2px]" style={{ height: `${top}%` }}>
                    {b.dropped > 0 && (
                      <div
                        className="rounded-t-[4px]"
                        style={{
                          flexGrow: b.dropped,
                          background: DROPPED,
                          minHeight: 3,
                        }}
                      />
                    )}
                    {b.count > 0 && (
                      <div
                        className={b.dropped > 0 ? "" : "rounded-t-[4px]"}
                        style={{
                          flexGrow: b.count,
                          background: REACHED,
                          minHeight: 3,
                        }}
                      />
                    )}
                  </div>
                  {/* on a small plate, as PostHog: readable over the hatching */}
                  <span className="absolute inset-x-0 flex justify-center" style={{ bottom: `calc(${(b.ofFirst ?? 0) * 100}% + 4px)` }}>
                    <span className="rounded-[4px] bg-surface px-1.5 py-px text-xs font-medium text-fg shadow-sm ring-1 ring-line tabular-nums">
                      {formatShare(b.ofFirst)}
                    </span>
                  </span>
                  <div
                    className={`pointer-events-none absolute top-0 z-20 hidden min-w-48 rounded-md border border-line bg-surface p-2 text-xs shadow-lg group-hover:block ${i < bars.length / 2 ? "left-1/2" : "right-1/2"}`}
                  >
                    <div className="mb-1 font-medium text-fg">
                      {i + 1}. {steps[i].label}
                    </div>
                    {[
                      ["Leute", String(b.count)],
                      ["von Schritt 1", formatShare(b.ofFirst)],
                      ...(i > 0
                        ? [
                            ["vom Schritt davor", formatShare(b.ofPrev)],
                            ["abgesprungen", `${b.dropped}`],
                          ]
                        : []),
                      ...(steps[i].note ? [[steps[i].note, ""]] : []),
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-4 text-fg-2">
                        <span>{k}</span>
                        <span className="font-mono tabular-nums">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {/* Under each bar its step; on a phone only the number, the details as a list below. */}
      <div className="mt-3 flex gap-3 pl-10 sm:gap-6">
        {bars.map((b, i) => (
          <div key={steps[i].label} className="min-w-0 flex-1 text-xs text-fg-3">
            <div className="flex items-center justify-center gap-1.5 text-sm font-medium text-fg sm:justify-start">
              <StepNumber n={i + 1} />
              <span className="hidden truncate sm:inline" title={steps[i].label}>
                {steps[i].label}
              </span>
            </div>
            <div className="hidden sm:block">
              <StepDetails b={b} first={i === 0} note={steps[i].note} />
            </div>
          </div>
        ))}
      </div>
      <ol className="mt-4 space-y-3 sm:hidden">
        {bars.map((b, i) => (
          <li key={steps[i].label} className="flex gap-2 text-xs text-fg-3">
            <StepNumber n={i + 1} />
            <div>
              <div className="text-sm font-medium text-fg">{steps[i].label}</div>
              <StepDetails b={b} first={i === 0} note={steps[i].note} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[11px] font-medium text-fg-2 tabular-nums">{n}</span>
  );
}

function StepDetails({ b, first, note }: { b: Bar; first: boolean; note?: string }) {
  return (
    <div className="mt-1 tabular-nums">
      <div>
        <span className="text-fg-2">{b.count}</span> Leute{!first && <span> · {formatShare(b.ofPrev)} vom Schritt davor</span>}
      </div>
      {!first && <div>{b.dropped} abgesprungen</div>}
      {note && <div>{note}</div>}
    </div>
  );
}

/** The top of a rate graph's scale: the next round step above the highest point, at most 100 %. */
function niceMax(top: number): number {
  return [1, 2, 5, 10, 20, 25, 50, 75, 100].find((s) => s >= top * 1.1) ?? 100;
}

const ddmm = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}.`;

/**
 * One rate over time (a small multiple under Conversion): a thin line on its own scale, the changes as
 * numbered marks at their day, a dot and tooltip per point on hover.
 */
export function TrendLine({
  title,
  points,
  marks,
  height = 120,
}: {
  title: string;
  points: TrendPoint[];
  marks: { n: number; at: number; text: string }[];
  height?: number;
}) {
  // No rate where nobody reached the first step (PostHog says 0), nor in the weeks before the app sent
  // the events at all (its first rates are all 0): a gap, not a drop.
  const first = points.findIndex((p) => p.of > 0 && p.rate > 0);
  const has = (i: number) => first >= 0 && i >= first && points[i].of > 0;
  const shown = points.map((_, i) => i).filter(has);
  if (points.length < 2 || shown.length === 0) return <p className="py-8 text-center text-xs text-fg-3">{title}: noch zu wenig Daten.</p>;
  // The last bucket is the running one: dashed, and the number on top is the last complete bucket's.
  const running = points.length - 1;
  const done = shown.filter((i) => i < running);
  const head = points[done.length ? done[done.length - 1] : shown[shown.length - 1]];
  const max = niceMax(Math.max(...shown.map((i) => points[i].rate)));
  const x = (i: number) => (i / (points.length - 1)) * 100;
  const y = (rate: number) => 100 - (rate / max) * 100;
  const d = done.map((i) => `${i > first && has(i - 1) && done.includes(i - 1) ? "L" : "M"}${x(i)},${y(points[i].rate)}`).join(" ");
  const tail = has(running) && done.includes(running - 1) ? `M${x(running - 1)},${y(points[running - 1].rate)} L${x(running)},${y(points[running].rate)}` : "";
  const step = 100 / (points.length - 1);
  // Marks close together (one week, several changes) stack their numbers instead of covering each other.
  const rows: number[] = [];
  const placed = [...marks].sort((a, b) => a.at - b.at).map((m, k, all) => {
    const row = k > 0 && m.at - all[k - 1].at < 0.06 ? rows[k - 1] + 1 : 0;
    rows.push(row);
    return { ...m, row };
  });
  const lift = Math.max(0, ...rows) * 14;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="truncate text-sm font-medium text-fg">{title}</h4>
        <span className="text-sm font-semibold text-fg tabular-nums">{formatShare(head.rate / 100)}</span>
      </div>
      <div className="relative mr-1" style={{ height, marginTop: 12 + lift }}>
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-line" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-line" />
        {/* the scale on the left: the newest changes, and their numbers, sit on the right */}
        <span className="pointer-events-none absolute -top-2 left-0 bg-surface pr-1 text-[10px] text-fg-4 tabular-nums">{max} %</span>
        {placed.map((m) => (
          <div key={m.n} className="pointer-events-none absolute top-0 bottom-0 border-l border-dashed border-fg-4" style={{ left: `${m.at * 100}%` }}>
            <span
              className="absolute -translate-x-1/2 rounded-full bg-surface-3 px-1 text-[10px] font-medium text-fg-2 tabular-nums"
              style={{ top: -10 - m.row * 14 }}
              title={m.text}
            >
              {m.n}
            </span>
          </div>
        ))}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          <path d={d} fill="none" stroke={REACHED} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {tail && <path d={tail} fill="none" stroke={REACHED} strokeWidth={2} strokeDasharray="3 3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
        </svg>
        {points.map((p, i) => (
          // A hit target one step wide, centred on its point: larger than the dot.
          <div key={p.day} className="group absolute top-0 bottom-0" style={{ left: `${x(i) - step / 2}%`, width: `${step}%` }}>
            {has(i) && (
              <span
                className="pointer-events-none absolute left-1/2 hidden size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--chart-1)] ring-2 ring-surface group-hover:block"
                style={{ top: `${y(p.rate)}%` }}
              />
            )}
            <div
              className={`pointer-events-none absolute top-full z-20 mt-1 hidden min-w-36 rounded-md border border-line bg-surface p-2 text-xs shadow-lg group-hover:block ${i < points.length / 2 ? "left-0" : "right-0"}`}
            >
              <div className="mb-1 font-medium text-fg">
                ab {ddmm(p.day)}
                {i === running && <span className="ml-1 font-normal text-fg-3">(läuft noch)</span>}
              </div>
              {has(i) ? (
                <>
                  <div className="flex justify-between gap-3 text-fg-2">
                    <span>{title}</span>
                    <span className="font-mono tabular-nums">{formatShare(p.rate / 100)}</span>
                  </div>
                  <div className="text-fg-3 tabular-nums">
                    {p.reached} von {p.of} Leuten
                  </div>
                </>
              ) : (
                <div className="text-fg-3">keine Daten</div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-fg-3 tabular-nums">
        <span>{ddmm(points[0].day)}</span>
        <span>{ddmm(points[running].day)}</span>
      </div>
    </div>
  );
}
