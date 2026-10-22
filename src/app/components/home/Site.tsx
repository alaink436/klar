import Image from "next/image";
import Link from "next/link";
import localFont from "next/font/local";
import CreatorLinks from "./CreatorLinks";

// The light Klar Studios frame shared by the front page and /support: font,
// glass header with the chrome symbol, footer with the large wordmark.

const grotesk = localFont({
  src: "../../../fonts/intertight.woff2",
  weight: "400 600",
  variable: "--font-grotesk",
  display: "swap",
});

export const SUPPORT_EMAIL = "support@getklar.org";

export default function Site({ children }: { children: React.ReactNode }) {
  return (
    <div className={`home ${grotesk.variable}`}>
      <header className="fixed inset-x-0 top-0 z-30 px-3 pt-3 sm:px-5">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between rounded-full border border-white/60 bg-white/45 pl-2.5 pr-2.5 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl backdrop-saturate-150">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo/klar-symbol.png" alt="" width={40} height={40} className="size-10 object-contain" />
            <span className="text-[19px] font-semibold tracking-[-0.04em]">Klar Studios</span>
          </Link>
          {/* getklar.org is where creators land from TikTok; support stays in the footer (Basalt's store listing links /support). */}
          {/* With "Sign in" the row needs about 334 px: below 390 px (iPhone mini, small Androids) "Apps" steps aside. */}
          <nav className="flex items-center gap-3 whitespace-nowrap text-[13px] font-medium text-[var(--ink-2)] sm:gap-7">
            <Link href="/#apps" className="transition hover:text-[var(--ink)] max-[389px]:hidden">Apps</Link>
            <CreatorLinks />
          </nav>
        </div>
      </header>

      {children}

      <footer className="overflow-hidden border-t">
        <div className="mx-auto max-w-[1400px] px-5 pt-14 sm:px-8 md:px-12">
          <div className="flex flex-col justify-between gap-4 text-[13px] font-medium text-[var(--ink-2)] sm:flex-row">
            <span>Klar Studios · Switzerland</span>
            <div className="flex flex-wrap gap-6">
              <Link href="/support" className="transition hover:text-[var(--ink)]">Support</Link>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="transition hover:text-[var(--ink)]">{SUPPORT_EMAIL}</a>
            </div>
          </div>
          <p aria-hidden="true" className="mt-10 select-none text-[clamp(120px,30vw,460px)] font-semibold leading-[0.74] tracking-[-0.075em]">
            Klar
          </p>
          <p className="py-6 text-[12px] text-[var(--ink-3)]">© 2026 Klar Studios · Alain Kessler · Switzerland</p>
        </div>
      </footer>
    </div>
  );
}
