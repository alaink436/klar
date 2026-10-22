// getklar.org/dashboard: the creator platform (spec Projects/Klar/specs/
// creator-plattform). Ticket 02 brought sign-up and the bio code, ticket 03 the
// kit, ticket 04 the posts with their status and the strike notices, ticket 05
// the estimate for creators without a link and the link offer from 1000
// followers, ticket 06 the payouts. A paused or closed account gets no kit, but
// is still paid what its counted posts earned.
//
// Signed out: to /dashboard/login. Signed in: straight into the dashboard (Alain
// 2026-10-22: "nach dem Mail-Link sofort das eigene Dashboard mit den Slideshows",
// "so wenig Friktion wie möglich"); the account is created on the first visit and
// gets its kit at once. Not connected yet: "Connect your TikTok" above the tabs.
// Connected, not verified: the bio code. The profile sits at the top right, the
// content in four tabs (Alain: "Profil oben rechts", "wo sind die Tabs").

import Link from "next/link";
import { Images, ListChecks, TrendingUp, Wallet } from "lucide-react";
import { after } from "next/server";
import { redirect } from "next/navigation";
import Site from "../components/home/Site";
import { card } from "../components/home/formStyles";
import { getSessionUser } from "@/lib/supabaseAuth";
import { getAdminSettings, logNotifEvent } from "@/lib/adminSettings";
import { LINK_FOLLOWERS, creatorShortLink, ensureCreatorAccount } from "@/lib/creatorAccounts";
import { creatorEarning, latestModelRun, postEstimate } from "@/lib/creatorEarnings";
import { getCreatorKit } from "@/lib/creatorKit";
import { balances, listPayouts } from "@/lib/payouts";
import { listCreatorPosts } from "@/lib/postCheck";
import { findKlarApp } from "@/lib/klarApps";
import { flushNotifsIfBatchReady } from "@/lib/notifFlusher";
import Apps, { type AppChoiceItem } from "./Apps";
import ConnectTiktok from "./ConnectTiktok";
import Earnings from "./Earnings";
import Kit from "./Kit";
import LaptopHint from "./LaptopHint";
import Payouts from "./Payouts";
import Posts from "./Posts";
import ProfileMenu from "./ProfileMenu";
import VerifyStep from "./VerifyStep";

export const dynamic = "force-dynamic";
export const metadata = { title: "Creator dashboard · Klar Studios", robots: { index: false } };

// Basalt (registry slug wavelength) is the app with a kit; Kelva, Pocketmate (myloo) and Learnbound follow.
const APPS: AppChoiceItem[] = [
  ["wavelength", true],
  ["kelva", false],
  ["myloo", false],
  ["learnbound", false],
].map(([slug, live]) => {
  const app = findKlarApp(slug as string);
  return { name: slug === "myloo" ? "Pocketmate" : (app?.name ?? String(slug)), icon: app?.icon ?? "", live: live as boolean };
});

// As links, so the back button and a shared link land on the same tab. On a computer they stand in a column on the
// left like the menu of Klar Control (Alain 2026-10-22: "die Tabs links, so wie bei der Admin-Ansicht"); on a phone
// they stay a row of pills above the content.
const TABS = [
  ["ready", "Ready to post", Images],
  ["posts", "My posts", ListChecks],
  ["earnings", "Earnings", TrendingUp],
  ["payouts", "Payouts", Wallet],
] as const;
type Tab = (typeof TABS)[number][0];

const Later = () => (
  <p className={`${card} mt-8 text-[15px] leading-relaxed text-[var(--ink-2)]`}>
    Connect your TikTok above first. Once it is confirmed, this is where you see it.
  </p>
);

export default async function CreatorDashboard({ searchParams }: { searchParams: Promise<{ new?: string; tab?: string }> }) {
  const { new: notice, tab: asked } = await searchParams;
  const tab: Tab = TABS.find(([t]) => t === asked)?.[0] ?? "ready";
  const user = await getSessionUser();
  if (!user) redirect("/dashboard/login");
  const ensured = await ensureCreatorAccount(user.id, user.email ?? "");
  const account = ensured?.account ?? null;
  // A new account is the sign-up: it goes into the notification digest like a website application.
  if (ensured?.created) {
    const { app_slug, email } = ensured.account;
    after(async () => {
      if (!(await getAdminSettings({ revalidate: 30 })).notification_trigger_inquiry) return;
      await logNotifEvent({ event_type: "creator_signup", app_slug, handle: null, payload: { email } });
      await flushNotifsIfBatchReady();
    });
  }
  const link = account ? await creatorShortLink(account) : null;
  const verified = account?.verified_at ? account : null;
  const paused = !!account?.suspended_until && new Date(account.suspended_until) > new Date();
  const closed = !!account?.closed_at;
  const kit = account && !paused && !closed ? await getCreatorKit(account.id) : null;
  const posts = verified ? await listCreatorPosts(verified.id) : null;
  const run = verified ? await latestModelRun() : null;
  const earning = verified && run ? await creatorEarning(verified.id, run.month) : null;
  // After switching to a link, posts counted before still earn from the estimate.
  const estimated = verified && (!verified.has_link || earning) ? verified : null;
  const [balance] = verified ? await balances(verified.id).catch(() => []) : [];
  const payouts = verified ? await listPayouts(verified.id).catch(() => []) : [];
  const estimates =
    run && posts ? new Map(posts.filter((p) => p.status === "counts" || p.status === "approved").map((p) => [p.postId, postEstimate(run, p.views)])) : undefined;

  return (
    <Site nav={account ? <ProfileMenu email={account.email} handle={account.tiktok_handle} verified={!!verified} /> : undefined}>
      <main className="px-5 pb-24 pt-28 sm:px-8 md:flex md:p-0 md:pt-[84px]">
        {/* Flush with the left edge under the header, as high as the window, like the sidebar of Klar Control (Alain
            2026-10-22: "die Tabs müssen weiter links sein, halt wie bei der Admin-Ansicht"). Sticky rather than fixed,
            so it ends above the footer instead of covering it. */}
        {account && (
          <aside className="sticky top-[84px] hidden h-[calc(100dvh-84px)] w-[248px] shrink-0 border-r border-white/60 bg-white/35 px-4 pt-7 backdrop-blur-xl md:block">
            <nav aria-label="Dashboard">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-3)]">Dashboard</p>
              <div className="mt-3 grid gap-1">
                {TABS.map(([t, name, Icon]) => (
                  <Link
                    key={t}
                    href={t === "ready" ? "/dashboard" : `/dashboard?tab=${t}`}
                    aria-current={t === tab ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-medium transition ${t === tab ? "bg-white/75 text-[var(--ink)] shadow-[0_8px_24px_-16px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.9)]" : "text-[var(--ink-2)] hover:bg-white/40 hover:text-[var(--ink)]"}`}
                  >
                    <Icon className="size-[18px] shrink-0" strokeWidth={1.8} />
                    {name}
                  </Link>
                ))}
              </div>
            </nav>
          </aside>
        )}
        <div className="mx-auto w-full min-w-0 max-w-[720px] md:max-w-[800px] md:px-10 md:pb-24 md:pt-7">
          <p className="text-[13px] font-medium tracking-[-0.005em] text-[var(--ink-3)]">Creator dashboard</p>
          <h1 className="mt-3 text-[clamp(34px,5vw,48px)] font-medium leading-[0.95] tracking-[-0.045em]">
            {verified ? `Hi, @${verified.tiktok_handle}.` : "Your dashboard."}
          </h1>
          <div className="mt-5">
            <Apps apps={APPS} />
          </div>

          {!account && <p className={`${card} mt-8 text-[15px]`}>We couldn&apos;t load your dashboard. Reload the page in a moment.</p>}
          {account && !account.tiktok_handle && <ConnectTiktok />}
          {account?.tiktok_handle && !account.verified_at && <VerifyStep handle={account.tiktok_handle} code={account.bio_code} />}
          {verified && (closed || paused || verified.strikes > 0) && (
            <div className={`${card} mt-8 border-[#b42318]/30 text-[15px] leading-relaxed`}>
              {closed
                ? "Your account is closed after three rejected posts. We no longer read your posts; what you earned with posts that counted is still paid out."
                : paused
                  ? `Your account is paused until ${new Date(verified.suspended_until!).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}. Posts in this time don't count and you get no new posts.`
                  : verified.strikes >= 2
                    ? "Your pause is over. One more rejected post closes your account."
                    : "You have one warning: a post was rejected. A second rejection pauses your account for 30 days."}
            </div>
          )}

          {account && <LaptopHint email={account.email} />}

          {account && (
            <nav aria-label="Dashboard tabs" className="-mx-5 mt-8 overflow-x-auto px-5 sm:mx-0 sm:px-0 md:hidden">
              <div className="inline-flex gap-1 rounded-full border border-white/70 bg-white/50 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                {TABS.map(([t, name]) => (
                  <Link
                    key={t}
                    href={t === "ready" ? "/dashboard" : `/dashboard?tab=${t}`}
                    aria-current={t === tab ? "page" : undefined}
                    className={`whitespace-nowrap rounded-full px-3 py-2 text-[13.5px] font-medium transition sm:px-4 sm:text-[14px] ${t === tab ? "bg-[var(--ink)] text-[var(--paper)]" : "text-[var(--ink-2)] hover:text-[var(--ink)]"}`}
                  >
                    {name}
                  </Link>
                ))}
              </div>
            </nav>
          )}

          {account && tab === "ready" &&
            (kit ? (
              <Kit kit={kit.kit} waiting={kit.waiting} notice={notice} />
            ) : (
              <p className={`${card} mt-8 text-[15px] leading-relaxed text-[var(--ink-2)]`}>No new posts while your account is paused or closed.</p>
            ))}
          {account && tab === "posts" && (posts ? <Posts posts={posts} estimates={estimates} /> : <Later />)}
          {account && tab === "earnings" &&
            (verified ? (
              <>
                <div className={`${card} mt-8 grid gap-4 text-[15.5px] leading-relaxed`}>
                  <p>We now read your TikTok posts every 6 hours.</p>
                  {link ? (
                    <p>
                      Your link: <span className="font-medium">{link}</span>
                      <br />
                      <span className="text-[var(--ink-2)]">Put it in your bio. Every install through it counts exactly.</span>
                    </p>
                  ) : (
                    <p className="text-[var(--ink-2)]">
                      Without a link we estimate your share from your views and the app&apos;s sign-ups. Once you can add a
                      link to your bio, it counts exactly.
                    </p>
                  )}
                </div>
                {estimated && (
                  <Earnings run={run} earning={earning} offerLink={!closed && !estimated.has_link && (estimated.followers ?? 0) >= LINK_FOLLOWERS} followers={estimated.followers ?? 0} />
                )}
              </>
            ) : (
              <Later />
            ))}
          {account && tab === "payouts" && (verified ? <Payouts balance={balance ?? null} payouts={payouts} /> : <Later />)}
        </div>
      </main>
    </Site>
  );
}
