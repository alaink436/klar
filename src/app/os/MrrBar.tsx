import { readAppsMrr } from "@/lib/klarOsMrr";

// The ladder as a measured bar rather than a table you have to read. The scale
// is the thresholds themselves, the fill is what the apps actually earn, and
// the step under the fill is what that means for the two prices today.
//
// SHOW_FIGURE decides whether the absolute monthly revenue is printed next to
// the fill or whether the bar only shows the scale and the current step. The
// mechanic works either way; publishing the figure is a business decision, not
// a design one.
const SHOW_FIGURE = false;

interface Rung {
  step: number;
  floor: number;
  data: number;
  sync: number;
}

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

export default async function MrrBar({ ladder, openStep }: { ladder: Rung[]; openStep: number }) {
  const mrr = await readAppsMrr();
  const dollars = mrr ? mrr.cents / 100 : null;

  // The scale is logarithmic. Linear, a $500 threshold sits at five percent of
  // a $10,000 axis and the first three steps collapse into the left edge, which
  // is the opposite of what the reader needs to see.
  const top = ladder[ladder.length - 1].floor;
  const pos = (v: number) => {
    if (v <= 0) return 0;
    return Math.min(100, (Math.log10(v + 1) / Math.log10(top + 1)) * 100);
  };

  const reached = dollars === null ? openStep : ladder.filter((r) => dollars >= r.floor).length;
  const current = ladder[Math.max(0, reached - 1)] ?? ladder[0];
  const next = ladder[reached] ?? null;
  const fill = dollars === null ? 0 : pos(dollars);

  return (
    <div className="mrrbar">
      <div className="mrrbar-head">
        <span className="mrrbar-label">What the apps earn</span>
        {SHOW_FIGURE && dollars !== null ? (
          <span className="mrrbar-now">
            <b>{money(Math.round(dollars))}</b> a month
            {mrr && mrr.subscriptions ? ` · ${mrr.subscriptions} active subscriptions` : ""}
          </span>
        ) : (
          <span className="mrrbar-now">
            <b>Step {String(current.step).padStart(2, "0")}</b> of{" "}
            {String(ladder.length).padStart(2, "0")}
          </span>
        )}
      </div>

      <div className="mrrbar-track">
        <div className="mrrbar-fill" style={{ width: `${fill}%` }} />
        {ladder.slice(1).map((r) => (
          <span key={r.step} className="mrrbar-tick" style={{ left: `${pos(r.floor)}%` }} />
        ))}
      </div>

      {/* One column per step, each carrying the threshold that opens it and the
          two prices it costs. The open one is inverted, the same way the ladder
          table marks it. */}
      <ol className="mrrbar-steps">
        {ladder.map((r) => (
          <li key={r.step} className={r.step === current.step ? "is-open" : ""}>
            <span className="mrrbar-step-n">
              {String(r.step).padStart(2, "0")}
              {r.step === current.step ? <i> you are here</i> : null}
            </span>
            <span className="mrrbar-step-at">
              {r.floor === 0 ? `under ${money(ladder[1].floor)}` : `from ${money(r.floor)}`}
            </span>
            <span className="mrrbar-step-price">
              {money(r.data)} <i>once</i>
            </span>
            <span className="mrrbar-step-price">
              {money(r.sync)} <i>a month</i>
            </span>
          </li>
        ))}
      </ol>

      <p className="fine mrrbar-foot">
        {next
          ? `Both prices step up when the apps pass ${money(next.floor)} a month. Buying at a step keeps that step: the one-time purchase serves you the newest build forever, and a subscription holds the price it started at.`
          : `This is the last step. Buying at a step keeps that step.`}
        {mrr ? ` Measured from the apps' own revenue reporting, last read ${mrr.day}.` : ""}
      </p>
    </div>
  );
}
