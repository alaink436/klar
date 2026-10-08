// Tremor chartColors [v0.1.0]
//
// Redesign 2026-10-08 (Ticket 03): die Farbnamen zeigen nicht mehr auf die
// Tailwind-500er, sondern auf gedaempfte Tokens in admin/admin.css
// (`--chart-<name>`). Die Namen bleiben, damit die Aufrufer unveraendert
// laufen; welche App welchen Namen traegt, steht unten in APP_CHART_COLORS.

import { KLAR_APPS } from "@/lib/klarApps"

export type ColorUtility = "bg" | "stroke" | "fill" | "text"

export const chartColors = {
  blue: {
    bg: "bg-[var(--chart-blue)]",
    stroke: "stroke-[var(--chart-blue)]",
    fill: "fill-[var(--chart-blue)]",
    text: "text-[var(--chart-blue)]",
  },
  emerald: {
    bg: "bg-[var(--chart-emerald)]",
    stroke: "stroke-[var(--chart-emerald)]",
    fill: "fill-[var(--chart-emerald)]",
    text: "text-[var(--chart-emerald)]",
  },
  violet: {
    bg: "bg-[var(--chart-violet)]",
    stroke: "stroke-[var(--chart-violet)]",
    fill: "fill-[var(--chart-violet)]",
    text: "text-[var(--chart-violet)]",
  },
  amber: {
    bg: "bg-[var(--chart-amber)]",
    stroke: "stroke-[var(--chart-amber)]",
    fill: "fill-[var(--chart-amber)]",
    text: "text-[var(--chart-amber)]",
  },
  cyan: {
    bg: "bg-[var(--chart-cyan)]",
    stroke: "stroke-[var(--chart-cyan)]",
    fill: "fill-[var(--chart-cyan)]",
    text: "text-[var(--chart-cyan)]",
  },
  pink: {
    bg: "bg-[var(--chart-pink)]",
    stroke: "stroke-[var(--chart-pink)]",
    fill: "fill-[var(--chart-pink)]",
    text: "text-[var(--chart-pink)]",
  },
  lime: {
    bg: "bg-[var(--chart-lime)]",
    stroke: "stroke-[var(--chart-lime)]",
    fill: "fill-[var(--chart-lime)]",
    text: "text-[var(--chart-lime)]",
  },
  // Klar admin token-bound shades (monochrome, theme-aware via CSS vars).
  ink: {
    bg: "bg-[var(--chart-1)]",
    stroke: "stroke-[var(--chart-1)]",
    fill: "fill-[var(--chart-1)]",
    text: "text-[var(--chart-1)]",
  },
  steel: {
    bg: "bg-[var(--chart-2)]",
    stroke: "stroke-[var(--chart-2)]",
    fill: "fill-[var(--chart-2)]",
    text: "text-[var(--chart-2)]",
  },
  silver: {
    bg: "bg-[var(--chart-3)]",
    stroke: "stroke-[var(--chart-3)]",
    fill: "fill-[var(--chart-3)]",
    text: "text-[var(--chart-3)]",
  },
} as const satisfies {
  [color: string]: {
    [key in ColorUtility]: string
  }
}

export type AvailableChartColorsKeys = keyof typeof chartColors

export const AvailableChartColors: AvailableChartColorsKeys[] = Object.keys(
  chartColors,
) as Array<AvailableChartColorsKeys>

export const constructCategoryColors = (
  categories: string[],
  colors: AvailableChartColorsKeys[],
): Map<string, AvailableChartColorsKeys> => {
  const categoryColors = new Map<string, AvailableChartColorsKeys>()
  categories.forEach((category, index) => {
    categoryColors.set(category, colors[index % colors.length])
  })
  return categoryColors
}

export const getColorClassName = (
  color: AvailableChartColorsKeys,
  type: ColorUtility,
): string => {
  const fallbackColor = {
    bg: "bg-gray-500",
    stroke: "stroke-gray-500",
    fill: "fill-gray-500",
    text: "text-gray-500",
  }
  return chartColors[color]?.[type] ?? fallbackColor[type]
}

// Jede App behaelt ihre Farbe, festgemacht an ihrer Stelle in KLAR_APPS, egal
// welche anderen gerade eingeblendet sind: MyLoo gruen, Anime Vault violett,
// Yarn Stash orange, Kelva cyan, Basalt lime, Trubel blau.
const APP_CHART_COLORS: AvailableChartColorsKeys[] = ["blue", "emerald", "violet", "amber", "cyan", "pink", "lime"]

export function appChartColor(slug: string): AvailableChartColorsKeys {
  const i = KLAR_APPS.findIndex((a) => a.slug === slug)
  return APP_CHART_COLORS[(i < 0 ? 0 : i) % APP_CHART_COLORS.length]
}

const HUES = new Set(["blue", "emerald", "violet", "amber", "cyan", "pink", "lime"])

/** Dieselbe Farbe als CSS-Wert, fuer Punkte und Markierungen ausserhalb der Diagramme. */
export function chartColorValue(color: string): string {
  return HUES.has(color) ? `var(--chart-${color})` : "var(--fg-3)"
}
