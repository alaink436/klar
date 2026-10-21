// A small bar chart of one value per day, for the dashboard (ticket 05). Server
// component, plain SVG; each bar names its day and value on hover. `line` draws
// a second series as a dashed line, named in the legend.

const W = 640;
const H = 112;
const TOP = 8;

export default function DayBars({
  title,
  days,
  values,
  unit,
  line,
}: {
  title: string;
  days: string[];
  values: number[];
  unit: string;
  line?: { label: string; values: number[] };
}) {
  const max = Math.max(1, ...values, ...(line?.values ?? []));
  const step = W / Math.max(1, days.length);
  const bar = Math.max(3, Math.min(step - 2, step * 0.55));
  // With a line in front, the bars step back so the line stays readable.
  const opacity = line ? 0.25 : 0.8;
  const y = (v: number) => H - (v / max) * (H - TOP);
  const fmt = (v: number) => Math.round(v).toLocaleString("en-US");
  const day = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <figure className="mt-6">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 text-[13px] text-[var(--ink-2)]">
        <span className="font-medium text-[var(--ink)]">{title}</span>
        {line && (
          <span className="flex items-center gap-3 text-[var(--ink-3)]">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-[var(--ink)]" style={{ opacity }} /> {unit}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 border-t-2 border-dashed border-[var(--ink)]" /> {line.label}
            </span>
          </span>
        )}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-28 w-full" preserveAspectRatio="none" role="img" aria-label={title}>
        <line x1={0} x2={W} y1={H - 0.5} y2={H - 0.5} stroke="var(--hair)" />
        {values.map((v, i) => (
          <rect key={days[i]} x={i * step + (step - bar) / 2} y={y(v)} width={bar} height={Math.max(0, H - y(v))} rx={Math.min(4, bar / 2)} fill="var(--ink)" opacity={opacity}>
            <title>{`${day(days[i])}: ${fmt(v)} ${unit}`}</title>
          </rect>
        ))}
        {line && (
          <polyline
            points={line.values.map((v, i) => `${i * step + step / 2},${y(v)}`).join(" ")}
            fill="none"
            stroke="var(--ink)"
            strokeWidth={2}
            strokeDasharray="5 4"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      <div className="mt-1 flex justify-between text-[12px] tabular-nums text-[var(--ink-3)]">
        <span>{days.length ? day(days[0]) : ""}</span>
        <span>max {fmt(max)}</span>
        <span>{days.length ? day(days[days.length - 1]) : ""}</span>
      </div>
    </figure>
  );
}
