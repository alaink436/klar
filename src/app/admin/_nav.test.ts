import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NAV_ITEMS, navItemForPath, navTabs } from "./_nav";

// The groups only change the menu (Alain 2026-10-22: "nichts an der Verdrahtung zerstören"): every page keeps its
// URL and stays in the menu data, a tab page always sits under an entry of its own section.
describe("menu groups", () => {
  it("keeps a page file behind every entry", () => {
    for (const i of NAV_ITEMS) expect(existsSync(join(__dirname, i.href.replace(/^\/admin\//, ""), "page.tsx")), i.href).toBe(true);
  });

  it("puts every tab page under a sidebar entry of the same section", () => {
    for (const i of NAV_ITEMS.filter((x) => x.tabOf)) {
      const leader = NAV_ITEMS.find((x) => x.id === i.tabOf);
      expect(leader, i.id).toBeDefined();
      expect(leader!.tabOf, i.id).toBeUndefined();
      expect(leader!.section, i.id).toBe(i.section);
    }
  });

  it("finds the entry of a path and the tabs of its group", () => {
    expect(navItemForPath("/admin/formate")?.id).toBe("formats");
    expect(navItemForPath("/admin/creators/save")?.id).toBe("creators");
    expect(navTabs("/admin/auszahlung")?.map((i) => i.id)).toEqual(["creators", "formats", "review", "model", "payouts", "bewerbungen"]);
    expect(navTabs("/admin/creators")?.[0].id).toBe("creators");
    expect(navTabs("/admin/app-analytics")?.map((i) => i.id)).toEqual(["analytics", "app-analytics"]);
    expect(navTabs("/admin/inbox")).toBeNull();
    expect(navTabs("/admin/settings")).toBeNull();
  });
});
