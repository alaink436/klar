# 02: Gute Treffer

Status: erledigt
Blockiert von: 01 (Eine Datei rein, eine Frage, ein Treffer)
Aufwand: 1 bis 2 h

**Was zu bauen ist:** `brain-search` liefert brauchbare Treffer wie ein Nachschlagewerk: Bedeutung und exakte Wörter zusammen, auf Wunsch auf ein Projekt eingegrenzt, pro Treffer Pfad, Überschrift, Zeilenbereich und die ersten Zeilen. Ist der Brain-Index nicht erreichbar, sagt es das in einer Zeile, damit der Agent auf grep zurückfällt.

- [x] Hybride Suche: eine exakte ID oder Fehlermeldung trifft, eine umschriebene Frage trifft auch
- [x] Eingrenzung auf ein Projekt liefert nur Treffer aus dessen Ordner
- [x] Ausgabe zeigt pro Treffer Pfad, Überschrift, Zeilenbereich und Vorschau
- [x] Bei nicht erreichbarem Index: eine Zeile Meldung, kein Absturz
- [x] Tests von aussen für alle vier Punkte

## Kommentare

- 2026-10-07: erledigt. `brain.search(query_text, query_embedding, match_count, project_filter)` verbindet Vektor und Volltext (`simple`, Wörter ODER-verknüpft) per Reciprocal Rank Fusion, k = 60. `brain-search "<frage>" [-p <Projekt>] [-n <Anzahl>]` zeigt pro Treffer `pfad:von-bis  Überschriftenpfad` und zwei Vorschauzeilen. Fällt der Proxy aus, schreibt es eine Zeile nach stderr ("Brain-Index nicht erreichbar, grep benutzen") und endet mit Exit 1.
- Schema-Änderung auf `brain` eingespielt (Spalte `fts` plus GIN-Index, neue Signatur der Suchfunktion). Test von aussen 6 von 6 grün. Am echten Index mit echter Einbettung: `227ea54` (ein Commit-Hash) und `scan-yarn-label` treffen Zeilen 16-23, `-p Kelva` liefert "no hits".
