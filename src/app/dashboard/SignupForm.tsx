"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Chips } from "../components/home/CreatorForm";
import { card, field, label } from "../components/home/formStyles";

// Step 1 of the creator dashboard: TikTok name, country, platforms, link or not,
// and the tick that commission without a link is an estimate (spec
// creator-plattform, ticket 02). Every choice is a chip, never a native select
// menu, as on the front page.

const PLATFORMS = [
  { id: "tiktok", name: "TikTok" },
  { id: "instagram", name: "Instagram" },
  { id: "youtube", name: "YouTube" },
];
// Where our viewers sit (Basalt sign-ups by time zone, 2026-10): first as chips,
// the rest through the search.
const COMMON = ["US", "GB", "DE", "CH", "AT", "NL", "PL", "FR", "IT", "ES", "CA", "AU"];
const ALL =
  "AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CD CF CG CH CI CK CL CM CN CO CR CU CV CW CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WS XK YE ZA ZM ZW".split(" ");

const ERRORS: Record<string, string> = {
  bad_handle: "That does not look like a TikTok username.",
  bad_country: "Pick your country.",
  bad_platforms: "Pick where you post.",
  no_consent: "Tick the box so we know you read how you get paid.",
  handle_taken: "This TikTok account is already taken.",
  exists: "You already signed up. Reload the page.",
};

export default function SignupForm({ email }: { email: string }) {
  const router = useRouter();
  const names = useMemo(() => new Intl.DisplayNames(["en"], { type: "region" }), []);
  const countryName = (c: string) => names.of(c) ?? c;
  const [handle, setHandle] = useState("");
  const [country, setCountry] = useState("");
  const [search, setSearch] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["TikTok"]);
  const [link, setLink] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const matches = search.trim()
    ? ALL.filter((c) => countryName(c).toLowerCase().includes(search.trim().toLowerCase())).slice(0, 8)
    : [];
  const shown = [...new Set([...COMMON, ...(country && !COMMON.includes(country) ? [country] : []), ...matches])];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/dashboard/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle,
          country,
          // TikTok is always on: it is the platform we pay for.
          platforms: PLATFORMS.filter((p) => p.id === "tiktok" || platforms.includes(p.name)).map((p) => p.id),
          hasLink: link[0] === "yes",
          acceptedEstimate: consent,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!data.ok) throw new Error(ERRORS[data.error ?? ""] ?? "Something went wrong. Try again in a minute.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={`${card} mt-10 grid gap-7`}>
      <div>
        <p className="text-[22px] font-medium tracking-[-0.03em]">Your account</p>
        <p className="mt-1 text-[14.5px] text-[var(--ink-2)]">Signed in as {email}. You promote Basalt.</p>
      </div>

      <div>
        <label htmlFor="handle" className={label}>TikTok username</label>
        <input
          id="handle"
          required
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="@yourname"
          className={field}
        />
      </div>

      <div>
        <span className={label}>Country</span>
        <Chips
          options={shown.map(countryName)}
          value={country ? [countryName(country)] : []}
          onChange={(v) => setCountry(shown.find((c) => countryName(c) === v[0]) ?? "")}
        />
        <input
          aria-label="Search another country"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Another country"
          className={`${field} mt-3 h-10 text-[14px]`}
        />
      </div>

      <div>
        <span className={label}>Where you post</span>
        <Chips options={PLATFORMS.map((p) => p.name)} value={platforms} onChange={(v) => setPlatforms(v.includes("TikTok") ? v : ["TikTok", ...v])} multi />
        <p className="mt-2 text-[13px] text-[var(--ink-3)]">For now we pay for TikTok. Instagram and YouTube follow once we can measure them.</p>
      </div>

      <div>
        <span className={label}>Link in your TikTok bio</span>
        <Chips
          options={["No link", "I can add a link"]}
          value={link[0] === "yes" ? ["I can add a link"] : link[0] === "no" ? ["No link"] : []}
          onChange={(v) => setLink([v[0] === "I can add a link" ? "yes" : "no"])}
        />
        <p className="mt-3 max-w-[52ch] text-[14px] leading-relaxed text-[var(--ink-2)]">
          With a link, every install that comes through it is counted exactly and automatically. Without one, we
          estimate your share from your views and Basalt&apos;s sign-ups at the time your posts ran.
        </p>
      </div>

      <label className="flex items-start gap-3 text-[14.5px] leading-relaxed">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-4 accent-[var(--ink)]" />
        <span>
          I understand that without a link my commission is an estimate: 50% of the revenue our model assigns to my
          posts, from my views and Basalt&apos;s sign-ups. Only the slideshows you give me count.
        </span>
      </label>

      {error && <p className="text-[14px] text-[#b42318]">{error}</p>}
      <button
        type="submit"
        disabled={busy || !handle || !country || link.length === 0 || !consent}
        className="h-12 rounded-full bg-[var(--ink)] text-[15px] font-medium text-[var(--paper)] transition hover:opacity-85 disabled:opacity-40"
      >
        {busy ? "Saving" : "Continue"}
      </button>
    </form>
  );
}
