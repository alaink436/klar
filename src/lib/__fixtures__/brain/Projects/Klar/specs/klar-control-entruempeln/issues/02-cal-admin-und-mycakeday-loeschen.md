# 02: Cal Admin und MyCakeDay löschen

Status: in Arbeit
Session: Klar Dashboard entrümpeln (Sub-Agent 02), seit 2026-10-07 21:11
Blockiert von: 01 (Sicherungspunkt, Testgerüst und Seiten-Rundgang)
Aufwand: 1 bis 1,5 h

**Was zu bauen ist:** In der Seitenleiste von Klar Control gibt es weder Cal Admin noch den MyCakeDay-Bereich. Der Link „Cal in neuem Tab" in der Fusszeile ist weg, und das Layout fragt nicht mehr bei jeder Navigation mycakeday.ch nach ungelesenen Mails. Bookings bleibt unverändert.

- [ ] Cal-Admin-Seite, Navigationseintrag, Fusszeilen-Link, Texte (DE und EN) und die CSP-Freigabe für das Cal-Frame entfernt
- [ ] MyCakeDay-Bereich, Navigationsgruppe samt externer Einträge, Zähler im Layout und Anbindung an die Cakeday-API entfernt
- [ ] Palette (Cmd+K) und Menü-Einstellungen zeigen keine der beiden mehr
- [ ] Bookings lädt wie vorher
- [ ] Rundgang grün für alle bleibenden Seiten, gelöschte Pfade antworten 404
- [ ] `tsc`, `next build`, `lint` ohne neue Fehler; gemergt und auf Production deployt
