// Class strings of the light creator forms (front page, /dashboard). A plain
// module on purpose: server pages import `card` too, and a value imported from
// a "use client" file arrives there as a client reference, not as the string.

export const field =
  "h-12 w-full rounded-2xl border border-[var(--hair)] bg-white/70 px-4 text-[15px] outline-none transition placeholder:text-[var(--ink-3)] focus:border-[var(--ink)]";
export const label = "mb-2 block text-[13px] font-medium text-[var(--ink-2)]";
export const card =
  "rounded-[28px] border border-white/70 bg-white/50 p-6 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl sm:p-8";
// The e-mail card of the sign-in and sign-up pages: a little roomier, the shadow softer and wider.
export const authCard =
  "w-full max-w-[440px] rounded-[32px] border border-white/80 bg-white/60 p-7 shadow-[0_40px_90px_-45px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl sm:p-9";
