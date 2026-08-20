// POST /admin/referenz-video — das Video einer Referenz hochladen oder wegnehmen.
//
// Warum eine Route und keine Server-Action: hier geht eine Datei über die
// Leitung, bis 200 MB. Server-Actions gehen durch dieselbe Serialisierung wie
// jeder andere Aufruf und haben ein deutlich kleineres Body-Limit; ein
// gewöhnliches `multipart/form-data` an eine Route ist der Weg, den der Browser
// ohnehin am besten kann — und er funktioniert auch ohne JavaScript.
//
// Die Datei landet im privaten Bucket `referenzen` (Migration 0029). Fremde
// Videos sind fremdes Material: ein öffentlicher Bucket wäre eine
// Weiterveröffentlichung, und eine öffentliche Supabase-Adresse ist für immer
// draussen. Abgespielt wird über eine signierte URL, die der Server bei jedem
// Seitenaufruf frisch zieht.

import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { readCookie, ctEqual } from "@/app/admin/_shared";
import { verifyDeviceCookie } from "@/lib/deviceCookie";
import { removeChannelVideo, uploadChannelFiles } from "@/lib/channelReference";
import { uploadPostSample } from "@/lib/postSample";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 200 MB, dasselbe Limit wie am Bucket. Ein Referenzclip ist 10 bis 30 Sekunden. */
const MAX_BYTES = 209_715_200;

function back(req: NextRequest, msg: string): Response {
  return NextResponse.redirect(
    new URL(`/admin/todos?v=referenzen&msg=${encodeURIComponent(msg.slice(0, 300))}`, req.url),
    303,
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  // Der Auth-Gate der Seite reicht für die Anzeige, aber eine Route ist eine
  // eigene, direkt aufrufbare URL — sie prüft ihre Berechtigung selbst.
  const KEY = process.env.KLAR_ADMIN_KEY ?? "";
  const DEV = process.env.KLAR_DEVICE_SECRET ?? "";
  if (!KEY || !DEV) return back(req, "nicht konfiguriert");
  if (!ctEqual(readCookie(req, "klar_admin"), KEY)) return back(req, "nicht angemeldet");
  if (!(await verifyDeviceCookie(readCookie(req, "klar_device"), DEV))) {
    return back(req, "nicht angemeldet");
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return back(req, "Datei konnte nicht gelesen werden");
  }

  // Zwei Ziele über dieselbe Route: ohne `art` wird die Referenz der Ebene
  // gewechselt, mit `art=post` kommt ein gelaufener Post in die Sammlung. Der
  // Ablauf ist identisch — Dateien prüfen, hochladen, zurück — und zwei Routen
  // wären zwei Stellen, an denen die Berechtigung geprüft werden müsste.
  const scope = String(form.get("scope") ?? "").trim();
  if (!scope) return back(req, "keine Ebene angegeben");

  if (String(form.get("aktion") ?? "") === "entfernen") {
    const res = await removeChannelVideo(scope);
    revalidatePath("/admin/todos");
    return back(req, res.ok ? `Referenz von ${scope} entfernt` : "Entfernen fehlgeschlagen");
  }

  // Mehrere Dateien, weil eine Slideshow zwei bis zehn Bilder ist. Die
  // Reihenfolge im Formular ist die Reihenfolge der Slides.
  const gewaehlt = form
    .getAll("datei")
    .filter((d): d is File => d instanceof File && d.size > 0);
  const istPost = String(form.get("art") ?? "") === "post";

  if (!gewaehlt.length) {
    // Ein Post ohne Datei ist trotzdem etwas wert: Alains Anweisung, worauf man
    // sich beziehen soll, ist die eigentliche Aussage der Zeile.
    if (istPost && String(form.get("notiz") ?? "").trim()) {
      const nur = await uploadPostSample(scope, [], {
        notiz: String(form.get("notiz") ?? ""),
        ergebnis: String(form.get("ergebnis") ?? ""),
      });
      revalidatePath("/admin/todos");
      return back(req, nur.ok ? "Notiz gespeichert, Datei fehlt noch" : "Speichern fehlgeschlagen");
    }
    return back(req, "keine Datei gewählt");
  }

  const zuGross = gewaehlt.find((d) => d.size > MAX_BYTES);
  if (zuGross) {
    return back(
      req,
      `„${zuGross.name}" ist ${Math.round(zuGross.size / 1_048_576)} MB, erlaubt sind 200 MB`,
    );
  }

  const dateien = await Promise.all(
    gewaehlt.map(async (d) => ({
      bytes: await d.arrayBuffer(),
      contentType: d.type,
      name: d.name,
    })),
  );

  const res = istPost
    ? await uploadPostSample(scope, dateien, {
        notiz: String(form.get("notiz") ?? ""),
        ergebnis: String(form.get("ergebnis") ?? ""),
      })
    : await uploadChannelFiles(scope, dateien);
  revalidatePath("/admin/todos");
  const wieviel = dateien.length === 1 ? "Datei" : `${dateien.length} Dateien`;
  return back(
    req,
    res.ok ? `${wieviel} für ${scope} hochgeladen` : (res.fehler ?? "Upload fehlgeschlagen"),
  );
}
