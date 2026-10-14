"use client";

// Die Dialoge der Creators-Seite: Nachfrage vor dem Entfernen und das Formular
// fuer eine App. Abgeschickt wird jeweils ein normales Formular an
// /admin/creators/save, das FormulareOhneSprung wie jedes andere abfaengt.
//
// Der Absende-Knopf ist ein gewoehnlicher Submit-Knopf, kein AlertDialogAction
// (das schluckt den POST, siehe VaultManager). Geschlossen wird erst nach dem
// Abschicken, im naechsten Takt, damit das Formular noch im Dokument haengt,
// wenn der Abfang es liest.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const klein = "h-8 px-3.5 text-[12.5px]";

export function BestaetigenKnopf({
  label,
  titel,
  text,
  felder,
}: {
  label: string;
  titel: string;
  text: string;
  felder: Record<string, string>;
}) {
  const [offen, setOffen] = useState(false);
  return (
    <AlertDialog open={offen} onOpenChange={setOffen}>
      <AlertDialogTrigger asChild>
        <Button variant="pill-dark" className={`${klein} text-danger`}>
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titel}</AlertDialogTitle>
          <AlertDialogDescription>{text}</AlertDialogDescription>
        </AlertDialogHeader>
        <form method="POST" action="/admin/creators/save" onSubmit={() => setTimeout(() => setOffen(false), 0)}>
          {Object.entries(felder).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="pill-dark">
                Abbrechen
              </Button>
            </AlertDialogCancel>
            <Button type="submit" variant="pill-dark" className="text-danger">
              {label}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export interface AppWerte {
  slug: string;
  name: string;
  shortPath: string;
  detourLink: string;
  storeUrl: string;
}

function Feld({
  id,
  label,
  name,
  wert,
  platzhalter,
  pflicht,
  muster,
}: {
  id: string;
  label: string;
  name: string;
  wert?: string;
  platzhalter?: string;
  pflicht?: boolean;
  muster?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} defaultValue={wert} placeholder={platzhalter} required={pflicht} pattern={muster} />
    </div>
  );
}

/** Ohne `app` legt der Dialog eine neue App an, mit `app` bearbeitet er sie. */
export function AppDialog({ app }: { app?: AppWerte }) {
  const [offen, setOffen] = useState(false);
  const id = app?.slug ?? "neu";
  return (
    <Dialog open={offen} onOpenChange={setOffen}>
      <DialogTrigger asChild>
        {app ? (
          <Button variant="pill-dark" className={klein}>
            Bearbeiten
          </Button>
        ) : (
          <Button variant="pill" className="h-9 px-5 text-[13px]">
            App hinzufügen
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{app ? app.name : "Neue App"}</DialogTitle>
          <DialogDescription>
            {app
              ? `Kurzlinks: getklar.org/${app.shortPath}/<handle>. Das Kürzel bleibt, damit verteilte Links weiter gehen.`
              : "Das Kürzel wird Teil jedes Kurzlinks: getklar.org/<kürzel>/<handle>. Es lässt sich danach nicht mehr ändern."}
          </DialogDescription>
        </DialogHeader>
        <form
          method="POST"
          action="/admin/creators/save"
          autoComplete="off"
          className="grid gap-4"
          onSubmit={() => setTimeout(() => setOffen(false), 0)}
        >
          <input type="hidden" name="action" value="app-save" />
          {app ? <input type="hidden" name="slug" value={app.slug} /> : null}
          <Feld id={`${id}-name`} label="Name" name="name" wert={app?.name} platzhalter="Basalt" pflicht />
          {app ? null : (
            <Feld id={`${id}-kurz`} label="Kürzel" name="short_path" platzhalter="basalt" pflicht muster="[a-z0-9\-]{2,24}" />
          )}
          <Feld
            id={`${id}-detour`}
            label="Detour-Link (leer = kein Detour, Creators zählen dann nichts)"
            name="detour_link"
            wert={app?.detourLink}
            platzhalter="https://klar.godetour.link/..."
          />
          <Feld
            id={`${id}-store`}
            label="Store-Link (Ziel des Kurzlinks ohne Detour)"
            name="store_url"
            wert={app?.storeUrl}
            platzhalter="https://apps.apple.com/app/id..."
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="pill-dark">
                Abbrechen
              </Button>
            </DialogClose>
            <Button type="submit" variant="pill">
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
