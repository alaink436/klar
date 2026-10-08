"use client";

// "Menü" section of the settings page: the same list the sidebar renders, with
// a switch per entry and move buttons. Deliberately the accessible twin of the
// sidebar drag — dragging is fast once you know it exists, but it is invisible
// and impossible with a keyboard, so the full list lives here with named
// controls.
//
// Writes the same `klar_nav` cookie through the same server action, so both
// editors can never disagree. Hiding is cosmetic: the page stays reachable by
// URL, which is why the copy says so.

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { TextureCard, TextureCardDescription, TextureCardHeader, TextureCardTitle } from "@/components/ui/texture-card";
import { Button } from "@/components/ui/button";
import { setNavPrefs } from "../nav-action";
import { orderedAll, type NavPrefs } from "../_nav";
import { tAdmin, type AdminLang } from "../_i18n";

export default function NavSettings({ lang, prefs }: { lang: AdminLang; prefs: NavPrefs }) {
  const t = tAdmin(lang);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const items = orderedAll(prefs);

  function save(next: NavPrefs) {
    startTransition(async () => {
      await setNavPrefs(next);
      router.refresh();
    });
  }

  function toggle(id: string) {
    const hidden = prefs.hidden.includes(id)
      ? prefs.hidden.filter((x) => x !== id)
      : [...prefs.hidden, id];
    save({ order: items.map((i) => i.id), hidden });
  }

  function move(id: string, dir: -1 | 1) {
    const ids = items.map((i) => i.id);
    const from = ids.indexOf(id);
    const to = from + dir;
    if (from === -1 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    save({ order: ids, hidden: prefs.hidden });
  }

  return (
    <TextureCard className="mb-6">
      <TextureCardHeader className="flex-col items-start gap-1.5">
        <TextureCardTitle>{t.navSettingsTitle}</TextureCardTitle>
        <TextureCardDescription className="max-w-[64ch]">{t.navSettingsBody}</TextureCardDescription>
      </TextureCardHeader>
      <ul className="list-none m-0 p-0" style={{ opacity: pending ? 0.6 : 1 }}>
        {items.map((item, i) => {
          const hidden = prefs.hidden.includes(item.id);
          return (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-6 py-2.5"
            >
              <span className={`min-w-[150px] flex-1 text-[13.5px] ${hidden ? "text-fg-4 line-through" : "text-fg"}`}>
                {t[item.labelKey] as string}
                <span className="ml-2 text-[10.5px] [font-family:var(--font-mono)] uppercase tracking-[0.1em] text-fg-4 no-underline">
                  {item.section === "studio" ? t.sectionStudio : t.sectionStudios}
                </span>
              </span>
              <div className="flex gap-2">
                <Button
                  variant="pill-dark"
                  size="sm"
                  disabled={pending || i === 0}
                  onClick={() => move(item.id, -1)}
                >
                  {t.navMoveUp}
                </Button>
                <Button
                  variant="pill-dark"
                  size="sm"
                  disabled={pending || i === items.length - 1}
                  onClick={() => move(item.id, 1)}
                >
                  {t.navMoveDown}
                </Button>
                <Button
                  variant={hidden ? "pill" : "pill-dark"}
                  size="sm"
                  disabled={pending}
                  onClick={() => toggle(item.id)}
                >
                  {hidden ? t.navShow : t.navHide}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {prefs.order.length > 0 || prefs.hidden.length > 0 ? (
        <div className="border-t border-line px-6 py-3.5">
          <Button variant="pill-dark" size="sm" disabled={pending} onClick={() => save({ order: [], hidden: [] })}>
            {t.navReset}
          </Button>
        </div>
      ) : null}
    </TextureCard>
  );
}
