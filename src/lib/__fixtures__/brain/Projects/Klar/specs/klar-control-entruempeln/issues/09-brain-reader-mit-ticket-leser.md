# 09: Brain-Reader mit Ticket-Leser

Status: bereit
Blockiert von: 01 (Sicherungspunkt, Testgerüst und Seiten-Rundgang)
Aufwand: 3 bis 4 h

**Was zu bauen ist:** Ein Module in Klar Control liest den Vault über GitHub, gecacht und mit typisierten Ergebnissen. Chronik und „Woran ich gerade arbeite" laufen darüber, STATUS.md wird pro Aufruf nur einmal geholt. Neu kann es alle Tickets aus dem Vault liefern, als Grundlage der Ticket-Ansicht.

- [ ] Ein Module mit einer gecachten Lese-Operation; die bestehenden Leser (Active-Now-Tabelle, Registry, PROGRESS-Sessions, Generator-Meldungen) ziehen dorthin, ihre Parser sind rein und exportiert
- [ ] Tickets finden über einen rekursiven Git-Baum von master, gelesen werden nur Dateien nach dem Muster `Projects/<Ordner>/specs/<feature>/issues/<NN>-<slug>.md`; Pfad-Wächter bleibt; Cache etwa 60 s
- [ ] Ticket-Modell: Projektordner, Feature, Nummer, Titel, Status, Blocker-Nummern, Fortschritt (abgehakt/gesamt), Session-Titel, Zeit des Nehmens, letzter Kommentar, frei ja/nein, GitHub-Link
- [ ] Unlesbare Tickets erscheinen als „nicht lesbar", nicht als still leere Liste
- [ ] Tests mit Beispieltickets über einen Beispiel-adapter: Blocker `keine (kann sofort starten)` und `01 (Titel), 02 (Titel)`, mit und ohne Kommentare, mit und ohne Session-Zeile, Windows-Zeilenenden, alle vier Status, Frontier, ein kaputtes Ticket
- [ ] Chronik und Übersicht zeigen dasselbe wie vorher; Rundgang grün
- [ ] `tsc`, `next build`, `lint` ohne neue Fehler; gemergt und auf Production deployt
