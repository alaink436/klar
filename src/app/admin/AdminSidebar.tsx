// Die Schiene von Klar Control, seit 2026-08-25 auf shadcn/ui gebaut.
//
// Was sich geaendert hat und was nicht:
//   - Der Rahmen kommt aus `components/ui/sidebar`. Vorher lag er als rund
//     sechzig Zeilen CSS im STYLE-String von `_shared.ts` und musste jede
//     Regel selbst mitbringen: Breite, Haftung, Scrollbalken, Zustaende.
//   - Die Symbole sind echte Komponenten aus `components/animate-ui/icons`
//     und bewegen sich, wenn man auf ihre Zeile zeigt. Vorher waren es
//     SVG-Zeichenketten, die per dangerouslySetInnerHTML in die Zeile
//     geschrieben wurden, in zwei Kopien mit dem Hinweis "keep these in sync".
//     Die Zuordnung steht jetzt einmal in `nav-icons.ts`.
//   - Alles, was die Schiene KANN, bleibt: Ziehen ordnet um, Ausblenden in den
//     Einstellungen, beides ueber dieselbe `klar_nav`-Cookie, die das Layout
//     vor dem Rendern liest. Der Block unten (Sprache, Einstellungen, Abmelden)
//     bleibt fest: er ist der Weg hinaus und gehoert nicht sortiert.
//
// Was die Form erzaehlt (unveraendert gegenueber vorher):
//   - Klar Studios traegt seit 2026-09-22 alles, was die Apps betrifft:
//     Feedback, Content, Collabs (mit der Zahl der offenen Anfragen),
//     Analytics, App-Nutzung.
//   - Der Creator-Zweig (Affiliate, Auszahlungen, die App-Seiten) ist seit
//     2026-10-07 geloescht.
//
// Abmelden bleibt ein einfaches <a>: es ist ein Route-Handler, der Cookies
// raeumt und umleitet.

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { AnimateIcon } from "@/components/animate-ui/icons/icon";
import { navIcon } from "./nav-icons";
import LangSwitch from "./LangSwitch";
import { setNavPrefs } from "./nav-action";
import { orderedAll, orderedSection, type NavItemDef, type NavPrefs } from "./_nav";
import { tAdmin, type AdminLang } from "./_i18n";

export default function AdminSidebar({
  active,
  lang,
  prefs,
  collabOpen = 0,
}: {
  active: string;
  lang: AdminLang;
  prefs: NavPrefs;
  /** Unbeantwortete Collab-Anfragen. Das ist die Zahl neben dem Eintrag. */
  collabOpen?: number;
}) {
  const t = tAdmin(lang);
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const studio = orderedSection("studio", prefs);
  const studios = orderedSection("studios", prefs);

  /** `dragged` dorthin schieben, wo `target` steht, alle anderen bleiben. */
  function reorder(dragged: string, target: string) {
    if (dragged === target) return;
    const ids = orderedAll(prefs).map((i) => i.id);
    const from = ids.indexOf(dragged);
    const to = ids.indexOf(target);
    if (from === -1 || to === -1) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    startTransition(async () => {
      await setNavPrefs({ order: ids, hidden: prefs.hidden });
      router.refresh();
    });
  }

  function navRow(item: NavItemDef, trailing?: ReactNode) {
    const isOver = overId === item.id && dragId !== null && dragId !== item.id;
    const Icon = navIcon(item.icon);
    const isActive = active === item.id;
    return (
      <SidebarMenuItem key={item.id}>
        {/* AnimateIcon umschliesst die ganze Zeile, damit die Bewegung beim
            Zeigen auf die ZEILE ausgeloest wird und nicht erst, wenn der
            Zeiger die 14 Pixel des Symbols trifft. */}
        <AnimateIcon animateOnHover>
          <SidebarMenuButton
            asChild
            isActive={isActive}
            tooltip={t[item.labelKey] as string}
            // Die Linie oben zeigt, wo der gezogene Eintrag landen wuerde.
            className={isOver ? "shadow-[inset_0_2px_0_0_var(--sidebar-foreground)]" : undefined}
          >
            <Link
              href={item.href}
              title={t.navDragHint}
              draggable
              onDragStart={(e) => {
                setDragId(item.id);
                e.dataTransfer.effectAllowed = "move";
                // Ein <a> zieht von Haus aus seine URL. Wir belegen die Fracht
                // selbst, damit der Empfaenger die Eintrags-Kennung sieht und
                // kein Link in einem fremden Fenster landet.
                e.dataTransfer.setData("text/plain", item.id);
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setOverId(item.id);
              }}
              onDragLeave={() => setOverId((c) => (c === item.id ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                const dropped = e.dataTransfer.getData("text/plain") || dragId;
                setDragId(null);
                setOverId(null);
                if (dropped) reorder(dropped, item.id);
              }}
            >
              <Icon size={16} />
              <span>{t[item.labelKey] as string}</span>
            </Link>
          </SidebarMenuButton>
        </AnimateIcon>
        {trailing}
      </SidebarMenuItem>
    );
  }

  const Einstellungen = navIcon("lock");
  const Abmelden = navIcon("logout");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="Klar Control">
              <Link href="/admin/overview" aria-label={t.brandHome}>
                <span className="flex aspect-square size-8 items-center justify-center overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo/klar-symbol.png" alt="" width={32} height={32} className="size-full object-contain" />
                </span>
                <span className="grid flex-1 leading-tight">
                  <span className="truncate font-[family-name:var(--font-display)] text-[20px] font-extrabold tracking-[-0.02em] text-[var(--fg)]">
                    Klar
                  </span>
                  <span className="truncate font-[family-name:var(--font-mono)] text-[9.5px] font-semibold uppercase tracking-[0.22em] text-[var(--fg-4)]">
                    Control
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t.sectionStudio}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {studio.map((item) => navRow(item))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Klar Studios (Alain, 2026-09-22): alles, was die Apps betrifft, in
            einem eigenen Menue. */}
        {studios.length > 0 ? (
          <SidebarGroup>
            <SidebarGroupLabel>{t.sectionStudios}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {studios.map((item) =>
                  navRow(
                    item,
                    item.id === "collabs" && collabOpen > 0 ? (
                      <SidebarMenuBadge
                        className="bg-[var(--danger)] text-white"
                        aria-label={t.collabOpenAria(collabOpen)}
                      >
                        {collabOpen}
                      </SidebarMenuBadge>
                    ) : undefined,
                  ),
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarFooter>
        <LangSwitch lang={lang} />
        <SidebarMenu>
          <SidebarMenuItem>
            <AnimateIcon animateOnHover>
              <SidebarMenuButton asChild isActive={active === "settings"} tooltip={t.navSettings}>
                <Link href="/admin/settings">
                  <Einstellungen size={16} />
                  <span>{t.navSettings}</span>
                </Link>
              </SidebarMenuButton>
            </AnimateIcon>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <AnimateIcon animateOnHover>
              {/* /admin/logout ist ein Route-Handler (raeumt Cookies, leitet
                  um), keine Seite. Die Navigation muss vollstaendig sein,
                  das schlichte <a> ist Absicht. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <SidebarMenuButton
                asChild
                tooltip={t.navLogout}
                className="text-[var(--fg-4)] hover:bg-transparent hover:text-[var(--danger)]"
              >
                <a href="/admin/logout">
                  <Abmelden size={16} />
                  <span>{t.navLogout}</span>
                </a>
              </SidebarMenuButton>
            </AnimateIcon>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
