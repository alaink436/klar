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
import { Card } from "@/components/ui/card";
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
    <Card className="p-0 overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-line">
        <div className="font-bold text-[14px] text-fg">{t.navSettingsTitle}</div>
        <p className="text-fg-3 text-[12px] mt-1 max-w-[64ch]">{t.navSettingsBody}</p>
      </div>
      <ul className="list-none m-0 p-0" style={{ opacity: pending ? 0.6 : 1 }}>
        {items.map((item, i) => {
          const hidden = prefs.hidden.includes(item.id);
          return (
            <li
              key={item.id}
              className="flex items-center gap-3 px-5 py-2.5 border-t border-line first:border-t-0"
            >
              <span className={`flex-1 text-[13.5px] ${hidden ? "text-fg-4 line-through" : "text-fg"}`}>
                {t[item.labelKey] as string}
                <span className="ml-2 text-[10.5px] [font-family:var(--font-mono)] uppercase tracking-[0.1em] text-fg-4 no-underline">
                  {item.section === "studio" ? t.sectionStudio : t.sectionCreator}
                </span>
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pending || i === 0}
                onClick={() => move(item.id, -1)}
              >
                {t.navMoveUp}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pending || i === items.length - 1}
                onClick={() => move(item.id, 1)}
              >
                {t.navMoveDown}
              </Button>
              <Button
                variant={hidden ? "outline" : "ghost"}
                size="sm"
                disabled={pending}
                onClick={() => toggle(item.id)}
              >
                {hidden ? t.navShow : t.navHide}
              </Button>
            </li>
          );
        })}
      </ul>
      {prefs.order.length > 0 || prefs.hidden.length > 0 ? (
        <div className="px-5 py-3 border-t border-line">
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => save({ order: [], hidden: [] })}>
            {t.navReset}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
