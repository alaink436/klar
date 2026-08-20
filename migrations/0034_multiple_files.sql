-- Mehrere Dateien je Referenz und je Post.
--
-- Bis 0033 hing genau eine Datei an einer Referenz und an einem Post. Das geht
-- an der Haelfte des Bestands vorbei: eine **Slideshow** ist zwei bis zehn
-- Bilder, kein Video. `basalt/pollinkerzz-carousel` ist genau so eine, und die
-- Richtung `Slideshow` laeuft aktuell auf zwei Kanaelen. Mit einem Dateifeld
-- haette Alain die erste Slide hochladen koennen und den Rest nicht.
--
-- `dateien text[]` statt einer zweiten Tabelle: die Reihenfolge IST die
-- Information (Slide 1, Slide 2), und ein Array haelt sie ohne Sortierspalte.
-- Eine Kindtabelle waere hier mehr Maschinerie fuer weniger Aussage.
--
-- `video_pfad` faellt weg statt liegenzubleiben. Beide Tabellen sind leer
-- (0 Zeilen, heute angelegt), es geht also nichts verloren — und eine tote
-- Spalte neben der lebenden ist genau die Doppelung, die spaeter jemand falsch
-- liest. Der Umzug steht trotzdem im Skript, damit es auch auf einer Kopie mit
-- Daten das Richtige tut.
--
-- `video_link` bleibt: die Adresse des Originals ist eine andere Aussage als
-- die Dateien und gilt weiter fuer den ganzen Eintrag.

-- ── Referenz je Ebene ───────────────────────────────────────────────────────
alter table public.klar_channel_reference
  add column if not exists dateien text[] not null default '{}';

update public.klar_channel_reference
   set dateien = array[video_pfad]
 where video_pfad is not null and cardinality(dateien) = 0;

alter table public.klar_channel_reference drop column if exists video_pfad;

comment on column public.klar_channel_reference.dateien is
  'Pfade im privaten Bucket, in Anzeigereihenfolge. Bei einer Slideshow mehrere, sonst eine. Leer = an dieser Ebene haengt nichts.';

-- ── Gelaufene Posts ─────────────────────────────────────────────────────────
alter table public.klar_post_sample
  add column if not exists dateien text[] not null default '{}';

update public.klar_post_sample
   set dateien = array[video_pfad]
 where video_pfad is not null and cardinality(dateien) = 0;

alter table public.klar_post_sample drop column if exists video_pfad;

comment on column public.klar_post_sample.dateien is
  'Pfade im privaten Bucket, in Anzeigereihenfolge. Ein Carousel bringt mehrere mit.';
