import type { Metadata } from "next";
import Site, { SUPPORT_EMAIL } from "../../components/home/Site";
import { fetchConsultDays } from "@/lib/consultSlots";
import SlotList from "./SlotList";

// getklar.org/consult/book: the open consult times first, then cal.com's form, then the CHF 99 RevenueCat checkout (via /consult/pay)
// (Alain, 2026-11-23: "dass man zuerst die offenen termine sieht, ehe man zum stripe-fenster kommt").
// Times come from two cal.com events, merged in lib/consultSlots: which ones are taken at once and which
// Alain confirms himself he sets in cal.com, the visitor never sees the difference.

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Book a call · Klar Studios",
  description: "Pick an open time for a call of about 60 minutes with Alain Kessler. CHF 99.",
  alternates: { canonical: "/consult/book" },
};

const FALLBACK = "https://cal.getklar.org/klar/consult";
const panel =
  "rounded-[28px] border border-white/70 bg-white/45 p-6 shadow-[0_30px_60px_-40px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl md:p-8";
export default async function BookConsult() {
  const days = await fetchConsultDays(14);
  return (
    <Site>
      <main>
        <section className="relative overflow-hidden">
          <div className="home-grid absolute inset-0" aria-hidden="true" />
          <div className="home-glow absolute inset-0" aria-hidden="true" />
          <div className="relative mx-auto max-w-[960px] px-5 pb-20 pt-32 sm:px-8 md:px-12 md:pb-28 md:pt-40">
            <p className="text-[13px] font-medium tracking-[-0.005em] text-[var(--ink-3)]">Book a call</p>
            <h1 className="mt-4 text-[clamp(34px,5vw,60px)] font-medium leading-[1.02] tracking-[-0.045em]">
              Pick a time that suits you.
            </h1>
            <p className="mt-5 max-w-[52ch] text-[17px] leading-relaxed text-[var(--ink-2)]">
              A call of about 60 minutes on your app. After you pick one you
              leave your name and email, then pay CHF 99 on the next page.
            </p>

            <div className={`mt-12 ${panel}`}>
              {days === null ? (
                <p className="text-[16px]">
                  The times did not load.{" "}
                  <a href={FALLBACK} className="underline underline-offset-4">
                    Open the calendar
                  </a>
                </p>
              ) : days.length === 0 ? (
                <p className="text-[16px]">
                  No open times in the next two weeks. Write me at{" "}
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-4">
                    {SUPPORT_EMAIL}
                  </a>
                  .
                </p>
              ) : (
                <SlotList slots={days.flatMap((d) => d.slots)} />
              )}
            </div>
          </div>
        </section>
      </main>
    </Site>
  );
}
