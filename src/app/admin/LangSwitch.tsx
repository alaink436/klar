"use client";

// DE/EN switch for the admin workspace. A server action writes the `klar_lang`
// cookie, then the route re-renders — the layout and every server component
// read that cookie, so the whole workspace (sidebar + page) comes back in the
// chosen language. Cookie instead of localStorage on purpose: the server has to
// know the language while rendering, otherwise the page paints German first and
// swaps after hydration.

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setAdminLang } from "./lang-action";
import { ADMIN_LANGS, tAdmin, type AdminLang } from "./_i18n";

export default function LangSwitch({ lang }: { lang: AdminLang }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const t = tAdmin(lang);

  function pick(next: AdminLang) {
    if (next === lang) return;
    startTransition(async () => {
      await setAdminLang(next);
      router.refresh();
    });
  }

  return (
    // Beim Einklappen der Schiene verschwindet der Schalter: zwei Kuerzel
    // nebeneinander sind auf Symbolbreite nicht mehr zu treffen, und die
    // Sprache stellt man ohnehin einmal ein und dann nie wieder.
    <div className="mt-2 px-1 group-data-[collapsible=icon]:hidden">
      <div className="mb-1 px-2 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[var(--fg-4)] [font-family:var(--font-mono)]">
        {t.langSection}
      </div>
      <div
        role="group"
        aria-label={t.langAria}
        title={t.langHint}
        className="flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface)] p-0.5"
        style={{ opacity: pending ? 0.6 : 1 }}
      >
        {ADMIN_LANGS.map((code) => {
          const on = code === lang;
          return (
            <button
              key={code}
              type="button"
              onClick={() => pick(code)}
              aria-pressed={on}
              disabled={pending}
              className={`flex-1 rounded-[calc(var(--radius-sm)-2px)] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] [font-family:var(--font-mono)] transition-colors ${
                on
                  ? "bg-[var(--surface-2)] text-[var(--fg)] shadow-[inset_0_0_0_1px_var(--line-strong)]"
                  : "text-[var(--fg-4)] hover:text-[var(--fg-2)]"
              }`}
            >
              {code}
            </button>
          );
        })}
      </div>
    </div>
  );
}
