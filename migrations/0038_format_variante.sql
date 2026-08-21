-- Eigene Varianten eines Formats, ohne den Freitext zurückzuholen.
--
-- 0027 hat die feste Liste eingeführt und den Freitext abgeschafft, und der
-- Grund steht dort ausführlich: nach vier Monaten Bestand trugen acht Zeilen
-- dieselbe Richtung in drei Schreibweisen (`Talking Head/ X-Format`,
-- `Talking Head X Format ausnutzen!`, `Auch wieder Talking Head Format hier!`),
-- und damit war nicht mehr zu beantworten, welche Richtung über alle Kanäle am
-- besten läuft. Das ist die Frage, für die es die Liste gibt.
--
-- Seit 0037 läuft neben dem teuren Format ein günstiges mit, und damit reicht
-- die Liste nicht mehr: zwei Kanäle fahren beide `Slideshow`, aber der eine
-- baut sie mit einem Generierungs-Anbieter und der andere aus Widget-Aufnahmen.
-- Alains eigener Grundtext vom 2026-08-21 sagt es: „Um Credits von Higgsfield
-- zu sparen. Hier einfach Widgettable format." Das ist eine VARIANTE von
-- Slideshow, keine neue Richtung.
--
-- Deshalb zwei Ebenen statt einer:
--
--   richtung   feste Liste, zählbar über alle Kanäle       — bleibt wie sie ist
--   variante   frei, unterscheidet innerhalb einer Richtung — neu
--
-- Die Auswertung „welche Richtung läuft am besten" bleibt damit möglich, und
-- die Frage „welche Slideshow-Machart läuft am besten" wird zusätzlich
-- möglich. Hätte man stattdessen die Liste geöffnet, wäre die erste Frage
-- wieder unbeantwortbar geworden, und genau das war 0027s Anlass.
--
-- Die Variante ist KEIN Richtungswechsel. Sie geht über `patchCurrent()` in die
-- laufende Zeile, wie Referenz und Spiegelung: von `Widget` auf `Widgets`
-- umzutippen ist eine Korrektur und darf keine Zeile im Verlauf erzeugen.
-- Wer wirklich die Machart wechselt, wechselt die Richtung oder beendet den
-- Platz — beides schreibt Verlauf.
--
-- Bewusst ohne Check-Constraint auf eine Werteliste: eine Variante ist der
-- Ort, an dem etwas Neues zuerst auftaucht. Die Länge deckelt der Code
-- (`clean(..., 80)`), wie bei den anderen Textfeldern dieser Tabelle.

alter table public.klar_account_direction
  add column if not exists variante text;

comment on column public.klar_account_direction.variante is
  'Freie Variante INNERHALB der Richtung, etwa Slideshow · Widget gegen Slideshow · Higgsfield. Ergaenzt die feste Liste in richtung, ersetzt sie nicht: richtung bleibt ueber alle Kanaele zaehlbar, die Variante unterscheidet innerhalb. Aenderung ist kein Richtungswechsel und erzeugt keinen Verlaufseintrag, gleiche Linie wie referenz und spiegelt.';
