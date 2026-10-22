// The frame of the sign-in and sign-up pages (Alain 2026-10-22: "zentriere das bitte korrekt", "etwas schöner"):
// everything centred, across and between header and footer, the chrome symbol of the header over the headline.

import Image from "next/image";
import Site from "../../components/home/Site";

export default function AuthFrame({
  title,
  sub,
  wide = false,
  children,
}: {
  title: string;
  sub: string;
  /** room for the three steps side by side on the sign-up page */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Site>
      <main
        className={`mx-auto flex min-h-[100svh] w-full flex-col items-center justify-center px-5 pb-11 pt-28 text-center sm:px-8 ${wide ? "max-w-[780px]" : "max-w-[520px]"}`}
      >
        <Image src="/logo/klar-symbol.png" alt="" width={64} height={64} priority className="size-14 object-contain" />
        <p className="mt-5 text-[13px] font-medium tracking-[-0.005em] text-[var(--ink-3)]">For creators</p>
        <h1 className="mt-3 text-[clamp(40px,6vw,64px)] font-medium leading-[0.95] tracking-[-0.05em]">{title}</h1>
        <p className="mt-4 max-w-[38ch] text-[17px] leading-snug text-[var(--ink-2)]">{sub}</p>
        {children}
      </main>
    </Site>
  );
}
