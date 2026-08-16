import { readAppsMrr } from "@/lib/klarOsMrr";

// The ladder as a progress bar, at the top of the page where the price belongs.
// Three rows, read top to bottom: what the apps earn right now, how far that is
// along the scale with every checkpoint marked, and what each checkpoint costs.
//
// The figure is real. /api/cron/app-metrics pulls each app's RevenueCat
// overview nightly into klar_app_metrics_daily and lib/klarOsMrr adds the
// newest day back up, so this cannot drift from the apps and cannot be typed in
// by hand.

interface Rung {
  step: number;
  floor: number;
  data: number;
  sync: number;
}

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

export default async function MrrBar({ ladder }: { ladder: Rung[] }) {
  const mrr = await readAppsMrr();
  const dollars = mrr ? mrr.cents / 100 : null;

  // Logarithmic. On a linear $10,000 axis the $500 checkpoint sits at five
  // percent and the first three steps pile into the left edge, which hides
  // exactly the part a reader is standing in.
  const top = ladder[ladder.length - 1].floor;
  const pos = (v: number) => (v <= 0 ? 0 : Math.min(100, (Math.log10(v + 1) / Math.log10(top + 1)) * 100));

  const reached = dollars === null ? 1 : Math.max(1, ladder.filter((r) => dollars >= r.floor).length);
  const current = ladder[reached - 1];
  const next = ladder[reached] ?? null;
  const fill = dollars === null ? 0 : pos(dollars);

  return (
    <section className="ladderbar" aria-label="Price ladder">
      <div className="ladderbar-top">
        <p className="ladderbar-now">
          <span className="ladderbar-cap">The apps earn</span>
          {dollars === null ? (
            <b>
              step {String(current.step).padStart(2, "0")} of{" "}
              {String(ladder.length).padStart(2, "0")}
            </b>
          ) : (
            <>
              <b>{money(Math.round(dollars))}</b>
              <span className="ladderbar-unit">a month</span>
            </>
          )}
        </p>
        <p className="ladderbar-next">
          {next
            ? `Both prices rise at ${money(next.floor)}. Yours does not: the step you buy at is the step you keep.`
            : `Last step reached.`}
        </p>
      </div>

      {/* The track. Checkpoints are labelled above it so the numbers sit next to
          the marks they belong to rather than under a column of prices. */}
      <div className="ladderbar-scale">
        {ladder.slice(1).map((r, i, all) => (
          <span
            key={r.step}
            className={`ladderbar-mark${i === all.length - 1 ? " is-last" : ""}`}
            style={{ left: `${pos(r.floor)}%` }}
          >
            {money(r.floor)}
          </span>
        ))}
      </div>
      <div className="ladderbar-track">
        <div className="ladderbar-fill" style={{ width: `${fill}%` }} />
        {dollars !== null ? (
          <span className="ladderbar-you" style={{ left: `${fill}%` }}>
            {money(Math.round(dollars))}
          </span>
        ) : null}
        {ladder.slice(1).map((r) => (
          <span key={r.step} className="ladderbar-tick" style={{ left: `${pos(r.floor)}%` }} />
        ))}
      </div>

      {/* Prices below. Every cell has the same three lines in the same order:
          which step, when it applies, what the two things cost. The row used to
          run four numbers together with no labels, so a reader had to guess
          which figure was the one-time purchase and which was the monthly one,
          and nothing said when step 02 starts. */}
      <p className="ladderbar-cap ladderbar-steps-cap">What you pay at each step</p>
      <ol className="ladderbar-steps">
        {ladder.map((r) => {
          const open = r.step === current.step;
          const passed = r.step < current.step;
          return (
            <li key={r.step} className={open ? "is-open" : passed ? "is-passed" : ""}>
              <span className="ladderbar-step-head">
                <b>Step {String(r.step).padStart(2, "0")}</b>
                {open ? <i>you are here</i> : null}
              </span>
              <span className="ladderbar-step-when">
                {r.floor === 0
                  ? `while the apps earn under ${money(ladder[1].floor)} a month`
                  : `once the apps earn ${money(r.floor)} a month`}
              </span>
              <span className="ladderbar-step-row">
                <span>The data</span>
                <b>{money(r.data)} once</b>
              </span>
              <span className="ladderbar-step-row">
                <span>The sync</span>
                <b>{money(r.sync)} a month</b>
              </span>
            </li>
          );
        })}
      </ol>

    </section>
  );
}
