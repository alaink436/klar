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
import { removeReferenceVideo, uploadReferenceVideo } from "@/lib/references";
import { removeChannelVideo, uploadChannelVideo } from "@/lib/channelReference";
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

  // Zwei Ziele über dieselbe Route: `scope` hängt das Video an eine Ebene
  // (App, Plattform, Kanal), `kennung` an einen Bibliothekseintrag. Der Ablauf
  // ist identisch — Datei prüfen, hochladen, zurück — und zwei Routen wären
  // zwei Stellen, an denen die Berechtigung geprüft werden müsste.
  const scope = String(form.get("scope") ?? "").trim();
  const kennung = String(form.get("kennung") ?? "").trim();
  const ziel = scope || kennung;
  if (!ziel) return back(req, "keine Ebene angegeben");

  if (String(form.get("aktion") ?? "") === "entfernen") {
    const res = scope ? await removeChannelVideo(scope) : await removeReferenceVideo(kennung);
    revalidatePath("/admin/todos");
    return back(req, res.ok ? `Video von ${ziel} entfernt` : "Entfernen fehlgeschlagen");
  }

  const datei = form.get("datei");
  if (!(datei instanceof File) || datei.size === 0) return back(req, "keine Datei gewählt");
  if (datei.size > MAX_BYTES) {
    return back(
      req,
      `Datei ist ${Math.round(datei.size / 1_048_576)} MB, erlaubt sind 200 MB`,
    );
  }

  const bytes = await datei.arrayBuffer();
  // `art=post` legt einen gelaufenen Post in die Sammlung des Kanals, statt die
  // Referenz der Ebene zu wechseln. Zwei verschiedene Fragen, ein Formular:
  // hier kommt in beiden Faellen eine Datei ueber dieselbe Leitung.
  const res =
    String(form.get("art") ?? "") === "post" && scope
      ? await uploadPostSample(scope, bytes, datei.type, datei.name, {
          notiz: String(form.get("notiz") ?? ""),
          ergebnis: String(form.get("ergebnis") ?? ""),
        })
      : scope
        ? await uploadChannelVideo(scope, bytes, datei.type, datei.name)
        : await uploadReferenceVideo(kennung, bytes, datei.type, datei.name);
  revalidatePath("/admin/todos");
  return back(
    req,
    res.ok ? `Video für ${ziel} hochgeladen` : (res.fehler ?? "Upload fehlgeschlagen"),
  );
}
