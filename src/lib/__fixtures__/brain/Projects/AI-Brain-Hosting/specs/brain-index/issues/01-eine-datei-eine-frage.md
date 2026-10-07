# 01: Eine Datei rein, eine Frage, ein Treffer

Status: erledigt
Blockiert von: keine (kann sofort starten)
Aufwand: 3 bis 5 h; Alain gibt die Migration auf Klar-Hub frei und trägt, falls nötig, den Klar-Hub-Zugang selbst im Klar-Vault ein

**Was zu bauen ist:** Der erste Durchstich durch alle Schichten. Das Schema `brain` existiert auf Klar-Hub, eine einzelne Vault-Datei wird in Abschnitte geschnitten, über den Klar-Vault-Proxy eingebettet und gespeichert, und `brain-search "<frage>"` findet sie per Bedeutung. Das Testgerüst aus der Spec (Mini-Vault, eigenes Test-Schema, Ersatz-Einbettung) läuft von Anfang an mit.

- [x] Schema `brain` auf Klar-Hub angelegt, nach Alains Freigabe, getrennt von den Dashboard-Tabellen
- [x] Zugang für Lesen und Schreiben läuft über den Klar-Vault-Proxy; kein Key im Repo oder Chat
- [x] Eine Datei wird an Überschriften in Abschnitte geschnitten, jeder mit Pfad, Überschriftenpfad, Zeilenbereich und Hash
- [x] `brain-search` liefert für eine anders formulierte Frage den richtigen Abschnitt
- [x] Test von aussen: Mini-Vault einspielen, Frage stellen, Treffer prüfen, gegen das Test-Schema, mit Ersatz-Einbettung

## Kommentare

- 2026-10-07: erledigt. Code in `Infrastructure/brain-index/` (`brain.py`, `brain-search`, `schema.sql`, `tests/`). Kein neuer Vault-Eintrag nötig: SQL über `Supabase Access Token (Overall)` und die Management-API, Einbettung über `OpenAi-API-Key`, beides per Proxy. Migration mit Alains Freigabe eingespielt (`vector` 0.8.0, Schema `brain`, RLS an). Rauchtest mit echtem Modell auf `Projects/AI-Brain-Hosting/PROGRESS.md`: 14 Abschnitte, 4828 Tokens; "Warum konnte man im Dashboard keine Schlüssel entfernen?" trifft Zeilen 16-23. Die Datei bleibt im Index liegen, 05 überschreibt sie beim Volllauf.
- Für 02: der Ersatz für die Einbettung ist ein Wortbeutel (Wörter ab 4 Zeichen). Exakt-Treffer bringt erst der Volltext aus 02.
