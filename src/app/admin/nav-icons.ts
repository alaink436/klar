// Welches Nav-Symbol welche Komponente ist.
//
// Loest `icons.ts` ab: dort standen die Symbole als SVG-Zeichenketten, die per
// dangerouslySetInnerHTML in die Zeile geschrieben wurden, und dieselbe Menge
// lag ein zweites Mal in `_shared.ts` mit dem Hinweis "keep these two in sync".
// Zwei Kopien von Hand gleich zu halten geht so lange gut, bis es das nicht
// mehr tut. Hier steht die Zuordnung einmal, und was sie liefert, ist eine
// echte React-Komponente aus `components/animate-ui/icons` mit eigener
// Bewegung beim Zeigen (`animateOnHover`).
//
// Die Schluessel sind die aus `_nav.ts`. Zwei davon heissen nach ihrer alten
// Zeichnung statt nach ihrem Zweck, das bleibt hier absichtlich so, damit
// `NAV_ITEMS` nicht angefasst werden muss:
//   `key`  = Vault (der Tresor)
//   `lock` = Einstellungen (fest unten in der Schiene verdrahtet)

import type { ComponentType } from "react";

import { LayoutDashboard } from "@/components/animate-ui/icons/layout-dashboard";
import { ClipboardList } from "@/components/animate-ui/icons/clipboard-list";
import { Inbox } from "@/components/animate-ui/icons/inbox";
import { MessageCircle } from "@/components/animate-ui/icons/message-circle";
import { MessageSquareDot } from "@/components/animate-ui/icons/message-square-dot";
import { Clapperboard } from "@/components/animate-ui/icons/clapperboard";
import { CalendarDays } from "@/components/animate-ui/icons/calendar-days";
import { ChartColumn } from "@/components/animate-ui/icons/chart-column";
import { Activity } from "@/components/animate-ui/icons/activity";
import { CircuitBoard } from "@/components/animate-ui/icons/circuit-board";
import { Clock } from "@/components/animate-ui/icons/clock";
import { LockKeyhole } from "@/components/animate-ui/icons/lock-keyhole";
import { Settings } from "@/components/animate-ui/icons/settings";
import { LogOut } from "@/components/animate-ui/icons/log-out";

/** Was eine Nav-Zeile von ihrem Symbol braucht, mehr nicht. */
export type NavIcon = ComponentType<{
  className?: string;
  size?: number;
  animateOnHover?: boolean;
}>;

export const NAV_ICON: Record<string, NavIcon> = {
  overview: LayoutDashboard,
  check: ClipboardList, // Tickets
  inbox: Inbox,
  reply: MessageSquareDot, // Collabs, der Punkt steht fuer unbeantwortet
  chat: MessageCircle, // Feedback
  content: Clapperboard,
  calendar: CalendarDays, // Bookings
  analytics: ChartColumn,
  activity: Activity, // App-Nutzung, der Puls der Apps
  brain: CircuitBoard, // Knoten und Kanten, wie der Graph selbst
  doc: Clock, // Chronik ist eine Zeitachse, kein Blatt
  key: LockKeyhole, // Vault
  lock: Settings, // Einstellungen
  logout: LogOut,
};

/** Symbol zu einem Schluessel, mit Rueckfall fuer unbekannte Eintraege. */
export function navIcon(key: string): NavIcon {
  return NAV_ICON[key] ?? LayoutDashboard;
}
