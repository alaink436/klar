import FreeKitForm from "./os/FreeKitForm";
import BrainGraph from "./os/BrainGraph";
import VaultDemo from "./os/VaultDemo";
import ProxyFlow from "./os/ProxyFlow";
import Triptych from "./os/Triptych";
import ShippedDeck from "./os/ShippedDeck";
import OsShell from "./os/OsShell";

// getklar.org's front page is Klar OS. The studio's old marketing homepage
// was retired when this moved in (2026-08-15, Alain's call); the affiliate
// landings under /affiliate/<app>, the partner dashboard, /log and every
// App-Store-required legal and support page are untouched and still live at
// their own URLs.

export const metadata = {
  title: "Klar OS: the operating system of a solo founder who ships",
  description:
    "The exact vault structure, agent conventions and LLM Council setup behind Klar Studios' shipped App Store apps. Free system, $49 playbook, honest scars included.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Klar OS: one person, six shipped apps",
    description:
      "The free working system of a solo founder who ships with AI agents daily. The scars behind it: the $49 Playbook.",
    url: "/",
    siteName: "Klar OS",
    images: [{ url: "/os/og.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Klar OS: one person, six shipped apps",
    description:
      "The free working system of a solo founder who ships with AI agents daily. The scars behind it: the $49 Playbook.",
    images: ["/os/og.png"],
  },
};

// The sync price climbs in steps. Each step is a fixed number of subscriptions
// at a fixed price; when it fills, the next opens and costs more. Nobody's own
// price moves: a Stripe subscription keeps the price it was created with, so
// raising the price means creating a NEW price and pointing
// KLAROS_STRIPE_SYNC_PRICE_ID at it. Existing subscribers carry on untouched,
// which is exactly what the page promises them.
//
// OPEN_STEP is the step selling right now. Move it by hand when one fills —
// deliberately not derived from a live subscriber count, because that count is
// a revenue figure and this page does not publish those.
const LADDER = [
  { step: 1, from: 1, to: 5, price: 19 },
  { step: 2, from: 6, to: 15, price: 29 },
  { step: 3, from: 16, to: 30, price: 39 },
  { step: 4, from: 31, to: 60, price: 49 },
  { step: 5, from: 61, to: null, price: 59 },
];
const OPEN_STEP = 1;

// Recurring revenue once a step is full, counted the way the promise works:
// everyone keeps the price they joined at, so each step adds its own seats at
// its own price on top of everything before it.
const RUNGS = (() => {
  let running = 0;
  return LADDER.map((r) => {
    const seats = r.to ? r.to - r.from + 1 : null;
    if (seats) running += seats * r.price;
    return { ...r, seats, mrr: seats ? running : null };
  });
})();

const money = (n) => `$${n.toLocaleString("en-US")}`;

const SKILLS = [
  { set: "Everything Claude Code", n: "59", who: "Affaan Mustafa", lic: "MIT", for: "API design, frontend and backend patterns, migrations, deployment, testing, docker, cost-aware model routing, eval harnesses" },
  { set: "Impeccable", n: "18", who: "Paul Bakaus", lic: "Apache 2.0", for: "UI and UX quality: full design review plus focused passes for type, colour, layout, polish and critique" },
  { set: "HyperFrames", n: "19", who: "HeyGen", lic: "Apache 2.0", for: "HTML plus a seekable timeline rendered to deterministic MP4, across ten creation workflows" },
  { set: "UI/UX Pro Max", n: "4", who: "Next Level Builder", lic: "MIT", for: "Design systems, banner design, UI styling" },
  { set: "LLM Council", n: "1", who: "tenfoldmarc", lic: "MIT", for: "Five adversarial advisors, anonymised and peer-reviewed, for decisions where being wrong is expensive", ships: true },
  { set: "Vault proxy setup", n: "1", who: "Klar Studios", lic: "MIT", for: "Builds your whole secrets infrastructure, then quizzes you until the model sticks", ships: true },
];

const DETAILS = {
  setup: (
    <>
      <div className="head">
        <p className="plate">01 / FREE</p>
        <div>
          <h2>The setup, and every skill in it</h2>
          <p className="lede" style={{ margin: 0 }}>
            The map below is the seller&apos;s real vault. Every node is a file,
            every line a reference the session rituals create, and the pulsing
            path is the lookup order that starts every session. Drag it around.
          </p>
        </div>
      </div>

      <div className="panel">
        <header>
          <span>ai-brain / live specimen</span>
          <span>drag &middot; hover &middot; click</span>
        </header>
        <BrainGraph />
      </div>

      <h3 style={{ marginTop: "var(--space-7)" }}>Every skill, with its author and licence</h3>
      <p className="fine" style={{ maxWidth: "70ch" }}>
        Two ship inside the kit with their licence text next to them. The rest
        are curated: the registry gives you the reason to load each one and the
        command to install it from its author, which is both correct and how you
        keep getting their updates. Sets with an unverifiable licence are left
        out on purpose, and the registry says so in writing.
      </p>
      <div className="table">
        <div className="row th">
          <span>Set</span><span>Skills</span><span>Author</span><span>Licence</span><span>What it is for</span>
        </div>
        {SKILLS.map((s) => (
          <div className="row" key={s.set}>
            <span className="k">{s.set}{s.ships ? <i>ships in the kit</i> : null}</span>
            <span className="n">{s.n}</span>
            <span>{s.who}</span>
            <span className="lic">{s.lic}</span>
            <span className="dim">{s.for}</span>
          </div>
        ))}
      </div>
      <p className="fine">
        Loading discipline is part of the system: skills live in an archive and
        are read when the task matches, never from an auto-load directory. A
        dozen auto-loaded skills is a tax on every session you will ever run.
      </p>

      <div className="card-cta">
        <p style={{ margin: 0 }}>
          <b>Get the system free.</b> One email, instant download, no account.
        </p>
        <FreeKitForm />
      </div>
    </>
  ),

  proxy: (
    <>
      <div className="head">
        <p className="plate">02 / FREE</p>
        <div>
          <h2>Keys your agent can <em>use but never see</em></h2>
          <p className="lede" style={{ margin: 0 }}>
            A key that lands in a chat is burned: it sits in logs, screenshots
            and storage you do not control. So in this design it never gets
            there. Below: what moves, then what happens when you try to break it.
          </p>
        </div>
      </div>
      <div className="panel">
        <header><span>vault-proxy / mechanism</span><span>8s loop</span></header>
        <ProxyFlow />
      </div>
      <div className="panel" style={{ marginTop: "var(--space-5)" }}>
        <header><span>vault-proxy / try it</span><span>simulation, nothing leaves this tab</span></header>
        <VaultDemo />
      </div>
      <p className="fine">
        The real thing installs itself: private repo, deployment, encrypted key
        store and the browser key window with 14 provider templates. It closes
        with a five-question quiz, and passing it is not optional.
      </p>
      <div className="card-cta">
        <p style={{ margin: 0 }}>
          <b>The proxy ships in the free kit.</b> Same download as the vault.
        </p>
        <FreeKitForm />
      </div>
    </>
  ),

  brain: (
    <>
      <div className="head">
        <p className="plate">03 / $49</p>
        <div>
          <h2>Five months of vault data</h2>
          <p className="lede" style={{ margin: 0 }}>
            The templates were never the valuable part, which is why they cost
            nothing. This is the part that took five months and six shipped
            apps to accumulate.
          </p>
        </div>
      </div>

      <div className="table">
        <div className="row th cols3"><span>Area</span><span>Volume</span><span>What is in there</span></div>
        <div className="row cols3"><span className="k">Learnings</span><span className="n">254</span><span className="dim">Every indexed entry: symptom, verified root cause, fix, rule. The heaviest tags are expo, silent-failure and verify-not-assume</span></div>
        <div className="row cols3"><span className="k">Working with LLMs</span><span className="n">6 sessions</span><span className="dim">Council adaptations from real business decisions, including why the optimist advisor has to be fed its own failures</span></div>
        <div className="row cols3"><span className="k">Shipping apps</span><span className="n">6 apps</span><span className="dim">Store review, TestFlight discipline, over-the-air updates, native build traps, entitlements and paywalls</span></div>
        <div className="row cols3"><span className="k">Web and sites</span><span className="n">multiple</span><span className="dim">Deploy pipelines, caching and immutability traps, server rendering boundaries, checkout and webhooks</span></div>
        <div className="row cols3"><span className="k">Distribution</span><span className="n">daily</span><span className="dim">Content pipelines that survive headless, scheduled cloud routines, posting automation</span></div>
        <div className="row cols3"><span className="k">Security</span><span className="n">chapter</span><span className="dim">The agent-safe secrets deep-dive, row-level policies, grants, and the gates that only look like gates</span></div>
        <div className="row cols3"><span className="k">Scaling and cost</span><span className="n">ongoing</span><span className="dim">Context budgets, rate limits, batch work that locks you out, model routing by cost</span></div>
        <div className="row cols3"><span className="k">Animation</span><span className="n">recipes</span><span className="dim">Easing that belongs on a position and not a frame index, sprite turnarounds, render pipelines</span></div>
      </div>

      <p className="fine" style={{ maxWidth: "72ch" }}>
        <b>Exactly what lands today:</b> all 254 learnings, redacted and indexed
        in English, plus the four written chapters. The entries themselves are
        the German originals, written during the work; English translations of
        the bodies follow in stages and your download page always serves the
        newest build. Every project name is removed: the lesson is the product,
        not which app happened to teach it. No revenue numbers anywhere, and
        none were ever written down.
      </p>

      <div className="card-cta paid">
        <div>
          <p className="price" style={{ marginBottom: 0 }}>$49<small>one-time, $79 after launch, 30-day refund</small></p>
        </div>
        <form action="/api/os/checkout" method="POST">
            <input type="hidden" name="plan" value="data" />
          <button className="btn pay" type="submit">Pre-order the data</button>
        </form>
      </div>
    </>
  ),
};

export default function Home() {
  return (
    <OsShell>
      <div className="wrap">
        <div className="topbar">
          <a className="mark" href="/">
            <img src="/os/bot.webp" alt="" width="28" height="28" />
            KLAR STUDIOS
          </a>
          <a className="to-buy" href="#pricing">Pricing &rarr;</a>
        </div>
        <div className="masthead">
          <h1 className="wordmark"><span>Klar</span> <span className="l2">OS</span></h1>
          <p className="lede" style={{ margin: 0 }}>
            One person shipped six apps to the App Store working with AI agents
            every day. Three things came out of it. Two are free, one is not.
            Pick one to open it.
          </p>
          <ShippedDeck />
        </div>
      </div>

      <Triptych details={DETAILS} />

      <div className="wrap">
        <section id="pricing">
          <div className="head">
            <p className="plate">PRICE</p>
            <div>
              <h2>Why two of the three are free</h2>
              <p className="lede" style={{ margin: 0 }}>
                You could rebuild the vault structure from screenshots, and the
                proxy is a pattern, not a secret. Giving those away costs me
                nothing and saves you a month. What is genuinely hard to get is
                knowing why each rule exists, and that is the only thing with a
                price on this page.
              </p>
            </div>
          </div>

          <div className="offer">
            <div>
              <p className="stamp">01 + 02, the system</p>
              <p className="price">Free<small>one email, instant download, no account</small></p>
              <ul className="checks">
                <li>The vault structure and rule set</li>
                <li>The skill registry, author and licence on every entry</li>
                <li>The self-installing reverse proxy, with the security quiz</li>
                <li>Onboarding that asks what you already know first</li>
              </ul>
              <FreeKitForm />
            </div>
            <div className="paid">
              <p className="stamp">03, the data</p>
              <p className="price">$49<small>one-time, $79 after launch, 30-day refund</small></p>
              <ul className="checks">
                <li>All 254 learnings, redacted, with an English index</li>
                <li>The four written chapters, immediately</li>
                <li>Real artifacts from the working vault</li>
                <li>First buyers shape what gets written next</li>
              </ul>
              <form action="/api/os/checkout" method="POST">
                <input type="hidden" name="plan" value="data" />
                <button className="btn pay" type="submit">Pre-order the data</button>
              </form>
            </div>
          </div>

          <div className="sub">
            <div>
              <p className="stamp">04, staying current</p>
              <h3 style={{ fontSize: "1.5rem", marginBottom: "var(--space-2)" }}>
                Keep your vault in sync with mine
              </h3>
              <p className="dim" style={{ maxWidth: "56ch" }}>
                The data purchase is a snapshot. This is the tap: every new
                learning I write lands in your vault, in your format, pulled by
                your own agent with the included sync skill. Category file
                first, index second, marked as someone else&apos;s evidence
                rather than yours.
              </p>
              <ul className="checks">
                <li>New learnings, monthly, merged by your agent, not emailed</li>
                <li>The corpus keeps growing; you keep getting it</li>
                <li>Reply to any monthly note and ask me something. I answer
                    personally when I can, and I am not promising a response time</li>
                <li>Cancel any month. The learnings you already merged stay yours</li>
                <li>The price you join at is the price you keep. Later steps cost
                    more; yours does not move</li>
              </ul>
            </div>
            <div className="subbuy">
              <p className="price">
                {money(LADDER[OPEN_STEP - 1].price)}
                <small>
                  per month, step {OPEN_STEP} of {LADDER.length}, cancel any time
                </small>
              </p>
              <form action="/api/os/checkout" method="POST">
                <input type="hidden" name="plan" value="sync" />
                <button className="btn pay" type="submit">Subscribe</button>
              </form>
              <p className="fine" style={{ marginTop: "var(--space-3)" }}>
                Needs the free system first, which is the point: without a vault
                there is nothing to sync into.
              </p>
            </div>
          </div>

          <div className="ladder">
            <p className="stamp">05, the ladder</p>
            <h3 style={{ fontSize: "1.5rem", marginBottom: "var(--space-2)" }}>
              The price climbs as the list does
            </h3>
            <p className="dim" style={{ maxWidth: "64ch" }}>
              Each step is a fixed number of subscriptions at a fixed price. When
              a step fills, the next one opens and costs more, because by then
              the corpus is bigger and there is less of me to go round. The last
              column is what the monthly revenue adds up to once that step is
              full, counted the way the promise works: everyone keeps the price
              they joined at, so each step stacks on top of the ones before it.
            </p>
            <div className="table">
              <div className="row th cols4">
                <span>Step</span>
                <span>Subscriptions</span>
                <span>Per month</span>
                <span>Recurring revenue when the step is full</span>
              </div>
              {RUNGS.map((r) => (
                <div
                  key={r.step}
                  className={`row cols4${r.step === OPEN_STEP ? " now" : ""}`}
                >
                  <span className="k" data-l="Step">
                    {String(r.step).padStart(2, "0")}
                    {r.step === OPEN_STEP ? <i className="tag"> open now</i> : null}
                  </span>
                  <span data-l="Subscriptions">
                    {r.to ? `${r.from} to ${r.to}` : `${r.from} and up`}
                  </span>
                  <span data-l="Per month">{money(r.price)}</span>
                  <span className="dim" data-l="Revenue when full">
                    {r.mrr ? `${money(r.mrr)} per month` : "grows from there"}
                  </span>
                </div>
              ))}
            </div>
            <p className="fine" style={{ maxWidth: "70ch" }}>
              Published so it is a commitment rather than a mood. The step that
              is open is the one marked above, and it changes when it fills, not
              when it suits me. Nothing here is retroactive, in either direction:
              a step that fills does not reprice the people already in it, and a
              step that fills slowly does not get cheaper.
            </p>
          </div>
        </section>

        <section className="faq">
          <div className="head">
            <p className="plate">Q &amp; A</p>
            <div><h2>Asked before buying</h2></div>
          </div>
          <details>
            <summary>Do I need Claude Code?</summary>
            <p>It is written with Claude Code in mind, but the system is plain Markdown and git, so any agent that reads files can run it. The self-installing parts assume an agent that can execute commands; by hand they follow the same written steps.</p>
          </details>
          <details>
            <summary>Are the skills included in the download?</summary>
            <p>Two of them are, with their licence text next to them. The other four sets are curated rather than redistributed: the registry tells you what each is for, who wrote it and under which licence, and you install it from the author. That respects their licences and means you get their updates instead of my frozen copy.</p>
          </details>
          <details>
            <summary>Mac, Windows or Linux?</summary>
            <p>All three. It is files in a git repo, nothing installs, and the setup scripts are cross-platform Node. The seller&apos;s own vault runs on Windows.</p>
          </details>
          <details>
            <summary>What language are the learnings in?</summary>
            <p>The titles and the index are English, all 254 of them. The entries themselves are the German originals, written at speed during the work. Translating them afterwards would have meant rewriting them, and a rewritten note is no longer evidence. Body translations follow in stages, and the four chapters are the English distillate.</p>
          </details>
          <details>
            <summary>What if it is not for me?</summary>
            <p>30 days, money back, no questions. Reply to your receipt and a human refunds you, the same one who wrote the vault.</p>
          </details>
          <details>
            <summary>Is my data safe with the agent setup?</summary>
            <p>No API key ever enters an AI chat. Keys go into a browser window, get encrypted server-side on a deployment you own, and agents use them through the proxy without seeing them. You can play that mechanic in panel two. The setup ends with a five-question quiz on exactly this model, and passing it is mandatory by design.</p>
          </details>
        </section>

        <footer>
          <p style={{ margin: 0 }}>
            Klar OS, built by Alain at Klar Studios in Switzerland.<br />
            Bundled third-party components keep their licences:{" "}
            <a href="https://github.com/tenfoldmarc/llm-council-skill">llm-council-skill</a>{" "}
            (MIT, tenfoldmarc), shipped with LICENSE and source link.
          </p>
          <p style={{ margin: 0 }}>
            App support and a real reply: <a href="/support">getklar.org/support</a><br />
            Questions about Klar OS: reply to any purchase email.
          </p>
        </footer>
      </div>
    </OsShell>
  );
}
