# 01: Sicherungspunkt, Testgerüst und Seiten-Rundgang

Status: erledigt
Session: Klar Dashboard entrümpeln (Sub-Agent 01), seit 2026-10-07 20:54
Blockiert von: keine (kann sofort starten)
Aufwand: 1,5 bis 2,5 h

**Was zu bauen ist:** Bevor irgendetwas gelöscht wird, lässt sich der heutige Stand von Klar Control mit einem Befehl zurückholen, das klar-Repo hat einen Test-Runner, und ein Rundgang ruft lokal jede Admin-Seite eingeloggt auf und meldet, welche nicht mit 200 antwortet. Mit diesem Rundgang nehmen alle folgenden Tickets ab.

- [x] Git-Tag `archiv/vor-entruempeln-2026-10` auf dem aktuellen master des klar-Repos, gepusht
- [x] `vitest` eingeführt, `npm test` läuft grün
- [x] Erste Tests für die schon reinen Prüfungen von Gerätecookie und TOTP (gültig, falsche Signatur, abgelaufen, falscher Code)
- [x] Rundgang-Skript: signiert lokal selbst ein Gerätecookie und ein Session-Cookie aus der lokalen Umgebung, ruft jede Admin-Seite gegen einen lokal laufenden Server auf und listet Pfad und Status; Ausgabe ohne Secrets
- [x] Rundgang heute einmal gelaufen, Ergebnis als Ausgangslage im Kommentar festgehalten (welche Seiten heute schon nicht 200 sind)
- [x] `tsc`, `next build` und `lint` ohne neue Fehler

## Kommentare

- 2026-10-07: erledigt. PR https://github.com/alaink436/klar/pull/23, gemergt als `6faf3b3`, Production-Deploy `success`; Login-Seite danach mit 0x `serviceKey`/`sb_secret_`/`eyJhbGci` und den 5 App-Kürzeln.
  - **Sicherungspunkt:** annotierter Tag `archiv/vor-entruempeln-2026-10` auf `4535b8e` (master vor jedem Merge dieser Spec), gepusht. Zurückholen: `git checkout archiv/vor-entruempeln-2026-10 -- <pfad>` oder ein Branch davon.
  - **Tests:** `vitest` 4 (nicht 5: verlangt `@types/node` ab 22, das Repo hat ^20). `npm test` = `vitest run`, Tests liegen neben dem Module (`src/lib/deviceCookie.test.ts`, `src/lib/totp.test.ts`), 11 grün. Keine vitest-Konfiguration nötig, tsc und `next build` vertragen die Dateien. Gegenprobe: Ablauf und Skew im Code gelockert, 3 Tests werden rot.
  - **Rundgang starten** (im eigenen Worktree, nach `npm ci` und Kopie der `.env.local`), in Git Bash:
    1. `npm run build`
    2. Server im Hintergrund: `KLAR_INBOX_SERVICE_KEY=rundgang-dummy npx next start -p 3100` (der Dummy-Key verhindert, dass `/admin/inbox` lokal wirft; die Datenabrufe scheitern dann still und die Seite rendert leer)
    3. `MSYS_NO_PATHCONV=1 npm run rundgang -- --port 3100 --gone /admin/cal,/admin/mycakeday` (ohne `MSYS_NO_PATHCONV=1` macht Git Bash aus `/admin/...` einen Windows-Pfad)
    4. Server beenden: TaskStop beendet nur die Bash-Hülle, der node-Prozess lauscht weiter. In PowerShell den Prozess auf Port 3100 per `Get-NetTCPConnection -LocalPort 3100 -State Listen` finden und mit `Stop-Process` beenden. Achtung, deutsches Windows: `netstat` zeigt `ABHÖREN`, nicht `LISTENING`.
  - **Ausgabe:** je Seite Pfad, Status, Soll und bei Weiterleitung das Ziel; `!!` markiert Abweichungen, Exit-Code 1 bei jeder Abweichung. Seiten kommen automatisch aus `src/app/admin/**/page.tsx`, `[app]` wird mit `kelva` gefüllt. Nur Seiten, keine `route.ts`.
  - **Wichtig für alle Folgetickets:** Die Admin-Seiten streamen (`admin/loading.tsx`), der HTTP-Status ist deshalb immer 200, auch bei `redirect()` und bei geworfenen Fehlern. Der Rundgang liest darum die React-Fehler-Digests aus dem Body (307 mit Ziel, 404, sonst 500). Mit vier Probeseiten geprüft: Wurf, Funktion als Prop an eine Client-Komponente, Wurf einer Client-Komponente beim SSR (alle 500) und `notFound()` (404). Alle vier bauten grün. Wer von Hand per curl prüft, sieht dort nur 200.
  - **Für die Lösch-Tickets:** Einsegmentige Pfade unter `/admin` landen auf der Affiliate-Detailseite `[app]` und antworten mit 307 nach `/admin/overview` statt 404, solange `[app]` existiert. `--gone /admin/cal` zeigt also bis zum Affiliate-Ticket 307. Zweisegmentige Pfade (z.B. `/admin/a/b`) antworten 404.
  - **Ausgangslage** (master `4535b8e`, `next start`, mit Dummy-Key): 26 Seiten, 23 mit 200. Nicht 200: `/admin/kelva` 307 nach `/admin/overview` (lokal fehlt `KLAR_ADMIN_APPS`), `/admin/mailer` und `/admin/replies` je 307 nach `/admin/inbox` (alte Weiterleitungen). Ohne Dummy-Key zusätzlich `/admin/inbox` 500 (`KLAR_INBOX_SERVICE_KEY env missing` aus `lib/supabaseAuth.ts`).
  - **Lint-Ausgangslage:** 148 Fehler, 41 Warnungen auf master (nicht 6, wie die Arbeitsanweisung sagt; die meisten in `legal/affiliate-agreement-fr|it`, `[app]`, `supabase/functions`, `migrations/templates`). Vorher und nachher gleich. `tsc` und `next build` grün.
  - Alain muss nichts tun.
