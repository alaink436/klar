// On a computer only (Alain 2026-10-22: "dass es Sinn macht die Seite auf dem Laptop zu öffnen, ein kleiner Hinweis"):
// TikTok slideshows are posted from the phone, so the dashboard says how to get there, with a QR code to the sign-in
// page. No e-mail in the code (personal data stays out of URLs); the creator signs in there with the same address.
// Shown to fine pointers from md up, so a phone held sideways doesn't get it.

import QRCode from "qrcode";

const SIGN_IN = "https://getklar.org/dashboard/login";

export default async function LaptopHint({ email }: { email: string }) {
  const svg = await QRCode.toString(SIGN_IN, { type: "svg", margin: 0, color: { dark: "#0e0e10", light: "#0000" } });
  return (
    <div className="mt-4 hidden items-center gap-4 rounded-[22px] border border-white/80 bg-white/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] md:pointer-fine:flex">
      <div className="size-[84px] shrink-0 rounded-xl bg-white p-2 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} />
      <div>
        <p className="text-[15px] font-medium tracking-[-0.02em]">Post from your phone</p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--ink-2)]">
          TikTok slideshows go up from the app. Scan this to open getklar.org on your phone and sign in with{" "}
          <span className="font-medium text-[var(--ink)]">{email}</span>. Your dashboard is the same there.
        </p>
      </div>
    </div>
  );
}
