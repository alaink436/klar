import FreeKitForm from "./os/FreeKitForm";
import BrainGraph from "./os/BrainGraph";
import VaultDemo from "./os/VaultDemo";
import ProxyFlow from "./os/ProxyFlow";
import Triptych from "./os/Triptych";
import ShippedDeck from "./os/ShippedDeck";
import FreeBracket from "./os/FreeBracket";
import MrrBar from "./os/MrrBar";
import OsShell from "./os/OsShell";

// getklar.org's front page is Klar OS. The studio's old marketing homepage
// was retired when this moved in (2026-08-15, Alain's call); the affiliate
// landings under /affiliate/<app>, the partner dashboard, /log and every
// App-Store-required legal and support page are untouched and still live at
// their own URLs.

// The price is indexed to the evidence, not to scarcity. What is for sale here
// is what six live apps taught one person, so the thing that makes it worth
// more is those apps earning more: a vault behind $200 a month is a hobby
// notebook, the same vault behind $10,000 a month is a manual. Every time the
// apps cross a step, both prices go up.
//
// Stated as thresholds rather than as a live figure. The step is public, the
// exact monthly revenue is not, and the promise on the page only needs the
// threshold to be checkable.
//
// OPEN_STEP is moved by hand when a threshold is crossed. Raising the sync
// price means creating a NEW Stripe price and pointing
// KLAROS_STRIPE_SYNC_PRICE_ID at it: a subscription keeps the price it was
// created with, so everyone already subscribed carries on untouched, which is
// what the page promises them.
// The climb is steep on purpose. A flat ladder says the evidence is worth
// roughly the same whether it came from a side project or from a studio at ten
// thousand a month, and if that were true there would be no reason to price it
// by traction at all. Step one is the only price anyone can buy today.
const LADDER = [
  { step: 1, floor: 0, data: 49, sync: 19 },
  { step: 2, floor: 500, data: 129, sync: 49 },
  { step: 3, floor: 2000, data: 249, sync: 89 },
  { step: 4, floor: 10000, data: 499, sync: 149 },
];
const OPEN_STEP = 1;

const money = (n) => `$${n.toLocaleString("en-US")}`;
const NOW = LADDER[OPEN_STEP - 1];
const NEXT = LADDER[OPEN_STEP] ?? null;

// The MRR bar reads a daily snapshot, so the page is regenerated hourly
// rather than baked once at build time.
export const revalidate = 3600;

export const metadata = {
  title: "Klar OS: the operating system of a solo founder who ships",
  description:
    `The exact vault structure, agent conventions and LLM Council setup behind Klar Studios' shipped App Store apps. Free system, ${money(NOW.data)} playbook, honest scars included.`,
  alternates: { canonical: "/" },
  openGraph: {
    title: "Klar OS: one person, six shipped apps",
    description:
      `The free working system of a solo founder who ships with AI agents daily. The scars behind it: the ${money(NOW.data)} Playbook.`,
    url: "/",
    siteName: "Klar OS",
    images: [{ url: "/os/og.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Klar OS: one person, six shipped apps",
    description:
      `The free working system of a solo founder who ships with AI agents daily. The scars behind it: the ${money(NOW.data)} Playbook.`,
    images: ["/os/og.png"],
  },
};

const SKILLS = [
  { set: "Everything Claude Code", n: "59", who: "Affaan Mustafa", lic: "MIT", for: "API, frontend, backend, migrations, deployment, testing, model routing" },
  { set: "Impeccable", n: "18", who: "Paul Bakaus", lic: "Apache 2.0", for: "Design review: type, colour, layout, polish, critique" },
  { set: "HyperFrames", n: "19", who: "HeyGen", lic: "Apache 2.0", for: "HTML plus a timeline, rendered to deterministic MP4" },
  { set: "UI/UX Pro Max", n: "4", who: "Next Level Builder", lic: "MIT", for: "Design systems, banners, UI styling" },
  { set: "LLM Council", n: "1", who: "tenfoldmarc", lic: "MIT", for: "Five adversarial advisors, for decisions where being wrong is expensive", ships: true },
  { set: "Vault proxy setup", n: "1", who: "Klar Studios", lic: "MIT", for: "Builds your secrets infrastructure, then quizzes you on it", ships: true },
];


const DETAILS = {
  setup: (
    <>
      <div className="head">
        <p className="plate">01 / FREE</p>
        <div>
          <h2>The setup, and every skill in it</h2>
          <p className="lede" style={{ margin: 0 }}>
            The map is the seller&apos;s real vault: every node a file, every
            line a reference the session rituals made. Drag it around.
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
        Two ship in the kit. The rest are curated, so you install them from
        their authors and keep getting their updates.
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
        Read when the task matches, never auto-loaded. A dozen auto-loaded
        skills is a tax on every session you run.
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
            A key that lands in a chat is burned. Here it never gets there.
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
        It installs itself: repo, deployment, encrypted store, 14 provider
        templates. Ends with a quiz you have to pass.
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
        <p className="plate">03 / {money(NOW.data)}</p>
        <div>
          <h2>Five months of vault data</h2>
          <p className="lede" style={{ margin: 0 }}>
            The templates cost nothing because they were never the valuable
            part. This took five months and six shipped apps.
          </p>
        </div>
      </div>

      <div className="table">
        <div className="row th cols3"><span>Area</span><span>Volume</span><span>What is in there</span></div>
        <div className="row cols3"><span className="k">Learnings</span><span className="n">254</span><span className="dim">Symptom, verified root cause, fix, rule</span></div>
        <div className="row cols3"><span className="k">Working with LLMs</span><span className="n">6 sessions</span><span className="dim">Council adaptations from real decisions</span></div>
        <div className="row cols3"><span className="k">Shipping apps</span><span className="n">6 apps</span><span className="dim">Store review, TestFlight, OTA, build traps, paywalls</span></div>
        <div className="row cols3"><span className="k">Web and sites</span><span className="n">multiple</span><span className="dim">Deploy pipelines, caching traps, checkout and webhooks</span></div>
        <div className="row cols3"><span className="k">Security</span><span className="n">chapter</span><span className="dim">Agent-safe secrets, row-level policies, fake gates</span></div>
        <div className="row cols3"><span className="k">Scaling and cost</span><span className="n">ongoing</span><span className="dim">Context budgets, rate limits, model routing by cost</span></div>
      </div>

      <p className="fine" style={{ maxWidth: "72ch" }}>
        <b>Today:</b> 254 learnings, redacted, English index, four chapters.
        Entries are the German originals; translations follow and your download
        page always serves the newest build. Project names are removed, because
        the lesson is the product.
      </p>

      <div className="card-cta paid">
        <div>
          <p className="price" style={{ marginBottom: 0 }}>{money(NOW.data)}<small>one-time, {money(NEXT.data)} at the next step, 30-day refund</small></p>
        </div>
        <form action="/api/os/checkout" method="POST">
            <input type="hidden" name="plan" value="data" />
          <button className="btn pay" type="submit">Pre-order the data</button>
        </form>
      </div>
    </>
  ),
};

export default async function Home() {
  return (
    <OsShell>
      <div className="wrap">
        <div className="topbar">
          <a className="mark" href="/">KLAR STUDIOS</a>
          <a className="to-buy" href="#pricing">Get it &rarr;</a>
        </div>
        <MrrBar ladder={LADDER} />

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

      <FreeBracket />

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
              <p className="stamp">the system</p>
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
              <p className="stamp">the data</p>
              <p className="price">{money(NOW.data)}<small>one-time, {money(NEXT.data)} at the next step, 30-day refund</small></p>
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
              <p className="stamp">staying current</p>
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
                {money(NOW.sync)}
                <small>
                  per month, step {String(OPEN_STEP).padStart(2, "0")} of{" "}
                  {String(LADDER.length).padStart(2, "0")}, cancel any time
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
