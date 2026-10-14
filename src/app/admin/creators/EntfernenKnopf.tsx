"use client";

// Entfernen-Knopf einer Creator-Zeile. Fragt einmal nach, weil der Kurzlink
// danach sofort nicht mehr geht. Abgeschickt wird ein normales Formular an
// /admin/creators/save, das FormulareOhneSprung wie jedes andere abfaengt.

import { Button } from "@/components/ui/button";

export function EntfernenKnopf({ app, handle, name }: { app: string; handle: string; name: string }) {
  return (
    <form method="POST" action="/admin/creators/save">
      <input type="hidden" name="action" value="remove" />
      <input type="hidden" name="app" value={app} />
      <input type="hidden" name="handle" value={handle} />
      <Button
        type="submit"
        variant="pill-dark"
        className="h-8 px-3.5 text-[12.5px] text-danger"
        onClick={(e) => {
          if (!window.confirm(`${name} entfernen? Sein Kurzlink geht danach nicht mehr.`)) e.preventDefault();
        }}
      >
        Entfernen
      </Button>
    </form>
  );
}
