import type { Metadata } from "next";
import Site, { SUPPORT_EMAIL } from "../../components/home/Site";

// getklar.org/consult/terms: the terms the RevenueCat checkout for a consult links to (required there).
// Klar Studios is a brand of Alain Kessler's sole proprietorship in Switzerland, not a company.

export const metadata: Metadata = {
  title: "Consult terms · Klar Studios",
  description: "What you get when you book a consult call with Alain Kessler, and how rescheduling and refunds work.",
  alternates: { canonical: "/consult/terms" },
};

const AS_OF = "24 November 2026";

const SECTIONS: { title: string; text: string }[] = [
  {
    title: "Who you book with",
    text: "Klar Studios is the brand of Alain Kessler, a sole proprietorship in Switzerland. The call is with Alain himself.",
  },
  {
    title: "What you get",
    text: "One video call of about 60 minutes on your app or project, at the time you picked. The price is CHF 99, paid in advance through the checkout of RevenueCat, which uses Stripe.",
  },
  {
    title: "Confirming your time",
    text: "Some times are confirmed right away, others by email within a day. If I cannot make a time you picked, I offer you another one or refund you in full.",
  },
  {
    title: "Rescheduling and cancelling",
    text: "You can move or cancel your call for free up to 24 hours before it starts, with the link in your booking email. If you cancel at least 24 hours ahead, you get a full refund. Later cancellations and missed calls are not refunded.",
  },
  {
    title: "What the call is not",
    text: "It is advice from one developer to another. You stay responsible for your own app, code, accounts and decisions. Nothing in the call is legal or tax advice.",
  },
  {
    title: "Questions and refunds",
    text: `Write to ${SUPPORT_EMAIL}. Swiss law applies.`,
  },
];

export default function ConsultTerms() {
  return (
    <Site>
      <main className="mx-auto max-w-[760px] px-5 pb-24 pt-32 sm:px-8 md:pt-40">
        <p className="text-[13px] font-medium tracking-[-0.005em] text-[var(--ink-3)]">Consult terms · as of {AS_OF}</p>
        <h1 className="mt-4 text-[clamp(32px,4.5vw,52px)] font-medium leading-[1.04] tracking-[-0.045em]">
          Booking a consult call
        </h1>
        <ol className="mt-12 space-y-9">
          {SECTIONS.map((s, i) => (
            <li key={s.title} className="grid grid-cols-[2.5rem_1fr] items-baseline">
              <span className="text-[13px] tabular-nums text-[var(--ink-3)]">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h2 className="text-[19px] font-medium tracking-[-0.02em]">{s.title}</h2>
                <p className="mt-2 text-[16px] leading-relaxed text-[var(--ink-2)]">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </main>
    </Site>
  );
}
