// The creator's payouts (ticket 06): what he is owed from closed months, from
// $25 the form for his Wise details, and what was sent. Server component, the
// form posts to /dashboard/wise.

import { card, field, label } from "../components/home/formStyles";
import type { Balance, Payout } from "@/lib/payouts";
import { MIN_PAYOUT_CENTS } from "@/lib/payouts";

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const STATUS: Record<Payout["status"], string> = {
  sending: "Being sent",
  sent: "Sent through Wise",
  failed: "Didn't go through, we'll sort it out",
};

function WiseForm({ email, name }: { email: string; name: string }) {
  return (
    <form action="/dashboard/wise" method="post" className="mt-4 grid gap-4 sm:grid-cols-2">
      <label>
        <span className={label}>Email of your Wise account</span>
        <input name="email" type="email" required defaultValue={email} className={field} autoComplete="email" />
      </label>
      <label>
        <span className={label}>Your full name, as on it</span>
        <input name="name" required minLength={2} maxLength={80} defaultValue={name} className={field} autoComplete="name" />
      </label>
      <button type="submit" className="h-11 w-fit rounded-full bg-[var(--ink)] px-5 text-[14px] font-medium text-white transition hover:opacity-85">
        Save
      </button>
    </form>
  );
}

export default function Payouts({ balance, payouts }: { balance: Balance | null; payouts: Payout[] }) {
  if (!balance && payouts.length === 0) return null;
  const owed = balance?.owedCents ?? 0;
  const through = balance?.throughMonth
    ? new Date(`${balance.throughMonth}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" })
    : null;
  const hasWise = !!balance?.wiseEmail;

  return (
    <section className="mt-12">
      <h2 className="text-[28px] font-medium tracking-[-0.03em]">Payouts</h2>
      <div className={`${card} mt-5 text-[15px] leading-relaxed`}>
        <p>
          <span className="font-medium tabular-nums">{usd(owed)}</span> owed to you{through ? ` for the months up to ${through}` : ""}.{" "}
          <span className="text-[var(--ink-2)]">
            {owed >= MIN_PAYOUT_CENTS ? "It's on this month's payout list." : "We pay out monthly from $25; below that it carries over."}
          </span>
        </p>
        {owed >= MIN_PAYOUT_CENTS && !hasWise && (
          <>
            <p className="mt-3 text-[var(--ink-2)]">Tell us where to send it. We pay through Wise; if something is missing, Wise emails you.</p>
            <WiseForm email="" name="" />
          </>
        )}
        {hasWise && (
          <details className="mt-3 text-[var(--ink-2)]">
            <summary className="cursor-pointer">
              Payouts go to {balance!.wiseEmail} through Wise. <span className="underline underline-offset-4">Change</span>
            </summary>
            <WiseForm email={balance!.wiseEmail ?? ""} name={balance!.wiseName ?? ""} />
          </details>
        )}
        {payouts.length > 0 && (
          <ul className="mt-4 divide-y divide-[var(--hair)] border-t border-[var(--hair)]">
            {payouts.map((p) => (
              <li key={p.id} className="flex justify-between gap-4 py-2.5 text-[14.5px]">
                <span className="tabular-nums">
                  {new Date(p.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · {usd(p.amount_cents)}
                </span>
                <span className="text-[var(--ink-3)]">{STATUS[p.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
